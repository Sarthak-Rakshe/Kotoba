using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.DataAccess.Entities;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class CurriculumPipelineService : ICurriculumPipelineService
{
    private readonly KotobaDbContext _context;
    private readonly ICurriculumContextService _contextService;
    private readonly ICurriculumPlannerService _plannerService;
    private readonly ICurriculumValidationService _validationService;
    private readonly IContentEnrichmentService _enrichmentService;
    private readonly IProgressionService _progressionService;
    private readonly ISystemLogService? _logService;

    public CurriculumPipelineService(
        KotobaDbContext context,
        ICurriculumContextService contextService,
        ICurriculumPlannerService plannerService,
        ICurriculumValidationService validationService,
        IContentEnrichmentService enrichmentService,
        IProgressionService progressionService,
        ISystemLogService? logService = null)
    {
        _context = context;
        _contextService = contextService;
        _plannerService = plannerService;
        _validationService = validationService;
        _enrichmentService = enrichmentService;
        _progressionService = progressionService;
        _logService = logService;
    }

    public async Task<LevelGenerationResultDto> GenerateAndPublishLevelAsync(LevelRequirements requirements)
    {
        int level = Math.Clamp(requirements.Level, 1, 60);
        int rCount = Math.Clamp(requirements.RadicalCount, 2, 20);
        int kCount = Math.Clamp(requirements.KanjiCount, 2, 30);
        int vCount = Math.Clamp(requirements.VocabCount, 2, 50);
        var normalizedReqs = requirements with { Level = level, RadicalCount = rCount, KanjiCount = kCount, VocabCount = vCount };

        _logService?.LogInfo("CURRICULUM_PIPELINE", $"Starting progressive generation for Level {level} (R:{rCount}, K:{kCount}, V:{vCount})");

        // 1. Build Curriculum Context from Database History
        var context = await _contextService.BuildContextAsync(level);

        // 2. STAGE 1: Curriculum Planning
        var proposedCurriculum = await _plannerService.GenerateLevelPlanAsync(level, context, normalizedReqs);

        // 3. Backend Validation
        var validation = _validationService.ValidateProposedCurriculum(proposedCurriculum, context, normalizedReqs);

        // 4. Partial Regeneration Loop (up to 2 repair passes if defects exist)
        int repairPass = 0;
        var validSubjects = new List<ProposedSubjectDto>(validation.ValidSubjects);
        var invalidSubjects = new List<ProposedSubjectDto>(validation.InvalidSubjects);

        while (invalidSubjects.Count > 0 && repairPass < 2)
        {
            repairPass++;
            _logService?.LogWarning("CURRICULUM_PIPELINE", $"Repair pass {repairPass}: regenerating {invalidSubjects.Count} invalid subjects for Level {level}");

            var replacements = await _plannerService.RegenerateInvalidSubjectsAsync(level, context, invalidSubjects, validation.Errors);
            var recheck = _validationService.ValidateProposedCurriculum(new ProposedCurriculum(level, replacements), context, normalizedReqs);

            validSubjects.AddRange(recheck.ValidSubjects);
            invalidSubjects = recheck.InvalidSubjects;
        }

        if (validSubjects.Count == 0)
        {
            throw new InvalidOperationException($"Curriculum planning validation failed completely: {string.Join(" | ", validation.Errors)}");
        }

        // 5. Deterministic Lesson Position Normalization:
        // Radicals first, then Kanji, then Vocab
        var orderedSubjects = new List<ProposedSubjectDto>();
        int currentPos = 1;

        foreach (var r in validSubjects.Where(s => s.Type == SubjectType.Radical).OrderBy(s => s.LessonPosition))
        {
            orderedSubjects.Add(r with { LessonPosition = currentPos++ });
        }
        foreach (var k in validSubjects.Where(s => s.Type == SubjectType.Kanji).OrderBy(s => s.LessonPosition))
        {
            orderedSubjects.Add(k with { LessonPosition = currentPos++ });
        }
        foreach (var v in validSubjects.Where(s => s.Type == SubjectType.Vocabulary).OrderBy(s => s.LessonPosition))
        {
            orderedSubjects.Add(v with { LessonPosition = currentPos++ });
        }

        // 6. Save Structural Subject Data in Database Transaction
        var savedEntities = new List<Subject>();
        using (var transaction = await _context.Database.BeginTransactionAsync())
        {
            try
            {
                foreach (var proposed in orderedSubjects)
                {
                    // Check if subject already exists in DB for this level
                    var existing = await _context.Subjects
                        .Include(s => s.Meanings)
                        .Include(s => s.Readings)
                        .Include(s => s.Mnemonics)
                        .Include(s => s.ExampleSentences)
                        .FirstOrDefaultAsync(s => s.Character == proposed.Character && s.Type == proposed.Type);

                    Subject entity;
                    if (existing != null)
                    {
                        entity = existing;
                        entity.Level = level;
                        entity.LessonPosition = proposed.LessonPosition;
                        _context.Meanings.RemoveRange(entity.Meanings);
                        _context.Readings.RemoveRange(entity.Readings);
                    }
                    else
                    {
                        entity = new Subject
                        {
                            Character = proposed.Character,
                            Type = proposed.Type,
                            Level = level,
                            LessonPosition = proposed.LessonPosition
                        };
                        _context.Subjects.Add(entity);
                    }

                    // Meanings
                    foreach (var m in proposed.Meanings.Where(m => !string.IsNullOrWhiteSpace(m.Meaning)))
                    {
                        entity.Meanings.Add(new Meaning
                        {
                            MeaningText = m.Meaning.Trim(),
                            IsPrimary = m.IsPrimary,
                            AcceptedAlternatives = m.Alternatives?.Trim()
                        });
                    }
                    if (entity.Meanings.Count == 0)
                    {
                        entity.Meanings.Add(new Meaning { MeaningText = proposed.Character, IsPrimary = true });
                    }

                    // Readings
                    if (proposed.Type != SubjectType.Radical && proposed.Readings != null)
                    {
                        foreach (var r in proposed.Readings.Where(r => !string.IsNullOrWhiteSpace(r.Reading)))
                        {
                            var rType = r.Type.Equals("Kunyomi", StringComparison.OrdinalIgnoreCase)
                                ? ReadingType.Kunyomi
                                : r.Type.Equals("VocabularyReading", StringComparison.OrdinalIgnoreCase)
                                ? ReadingType.VocabularyReading
                                : ReadingType.Onyomi;

                            entity.Readings.Add(new Reading
                            {
                                ReadingText = r.Reading.Trim(),
                                Type = rType,
                                IsPrimary = r.IsPrimary,
                                AcceptedAlternatives = r.Alternatives?.Trim()
                            });
                        }
                    }

                    savedEntities.Add(entity);
                }

                await _context.SaveChangesAsync();

                // 7. Create Subject Dependencies
                // Look up character -> Id mapping across current level and previous levels
                var allLevelCharacters = orderedSubjects
                    .SelectMany(s => s.ComponentCharacters.Concat(new[] { s.Character }))
                    .Distinct()
                    .ToList();

                var referencedSubjects = await _context.Subjects
                    .Where(s => allLevelCharacters.Contains(s.Character))
                    .ToListAsync();

                var subjectMap = referencedSubjects
                    .GroupBy(s => s.Character)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.Type == SubjectType.Radical ? 0 : s.Type == SubjectType.Kanji ? 1 : 2).First());

                foreach (var proposed in orderedSubjects)
                {
                    if (proposed.ComponentCharacters == null || proposed.ComponentCharacters.Count == 0)
                        continue;

                    if (!subjectMap.TryGetValue(proposed.Character, out var childEntity))
                        continue;

                    foreach (var compChar in proposed.ComponentCharacters)
                    {
                        if (subjectMap.TryGetValue(compChar, out var parentEntity) && parentEntity.Id != childEntity.Id)
                        {
                            bool depExists = await _context.SubjectDependencies.AnyAsync(d =>
                                d.ParentSubjectId == parentEntity.Id && d.ChildSubjectId == childEntity.Id);

                            if (!depExists)
                            {
                                _context.SubjectDependencies.Add(new SubjectDependency
                                {
                                    ParentSubjectId = parentEntity.Id,
                                    ChildSubjectId = childEntity.Id,
                                    DependencyType = childEntity.Type == SubjectType.Vocabulary
                                        ? DependencyType.VocabularyKanji
                                        : DependencyType.Component
                                });
                            }
                        }
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // 8. STAGE 2: Content Enrichment
        _logService?.LogInfo("CURRICULUM_PIPELINE", $"Running STAGE 2 Content Enrichment for {savedEntities.Count} subjects in Level {level}");
        try
        {
            var enriched = await _enrichmentService.EnrichSubjectsAsync(level, savedEntities);

            // Apply enrichments
            var enrichmentMap = enriched.Enrichments.ToDictionary(e => e.Character, StringComparer.Ordinal);
            foreach (var subject in savedEntities)
            {
                if (enrichmentMap.TryGetValue(subject.Character, out var en))
                {
                    subject.MeaningHint = en.MeaningHint;
                    subject.ReadingHint = en.ReadingHint;

                    // Clean previous mnemonics and sentences
                    var existingMnemonics = await _context.Mnemonics.Where(m => m.SubjectId == subject.Id).ToListAsync();
                    _context.Mnemonics.RemoveRange(existingMnemonics);

                    var existingSentences = await _context.ExampleSentences.Where(e => e.SubjectId == subject.Id).ToListAsync();
                    _context.ExampleSentences.RemoveRange(existingSentences);

                    if (!string.IsNullOrWhiteSpace(en.MeaningMnemonic))
                    {
                        _context.Mnemonics.Add(new Mnemonic
                        {
                            SubjectId = subject.Id,
                            Type = ReviewType.Meaning,
                            Text = en.MeaningMnemonic.Trim()
                        });
                    }

                    if (subject.Type != SubjectType.Radical && !string.IsNullOrWhiteSpace(en.ReadingMnemonic))
                    {
                        _context.Mnemonics.Add(new Mnemonic
                        {
                            SubjectId = subject.Id,
                            Type = ReviewType.Reading,
                            Text = en.ReadingMnemonic.Trim()
                        });
                    }

                    if (subject.Type == SubjectType.Vocabulary && en.ExampleSentences != null)
                    {
                        foreach (var es in en.ExampleSentences.Where(e => !string.IsNullOrWhiteSpace(e.Japanese)))
                        {
                            _context.ExampleSentences.Add(new ExampleSentence
                            {
                                SubjectId = subject.Id,
                                Japanese = es.Japanese.Trim(),
                                English = es.English.Trim(),
                                Furigana = es.Furigana?.Trim()
                            });
                        }
                    }
                }
            }
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logService?.LogWarning("CURRICULUM_PIPELINE", $"Enrichment stage encountered an issue: {ex.Message}. Subjects were successfully saved structurally.");
        }

        // 9. Auto unlock initial subjects for users currently on or above this level
        var usersOnLevel = await _context.Users
            .Where(u => u.CurrentLevel >= level)
            .Select(u => u.Id)
            .ToListAsync();

        foreach (var uId in usersOnLevel)
        {
            await _progressionService.UnlockInitialSubjectsForUserAsync(uId, level);
        }

        // 10. Formulate summary result
        var finalSubjects = await _context.Subjects
            .Where(s => s.Level == level)
            .Include(s => s.Meanings)
            .Include(s => s.Readings)
            .OrderBy(s => s.LessonPosition)
            .Select(s => new SubjectSummaryDto(
                s.Id,
                s.Character,
                s.Type,
                s.Level,
                s.Meanings.FirstOrDefault(m => m.IsPrimary) != null ? s.Meanings.FirstOrDefault(m => m.IsPrimary)!.MeaningText : s.Meanings.FirstOrDefault() != null ? s.Meanings.FirstOrDefault()!.MeaningText : "Unknown",
                s.Readings.FirstOrDefault(r => r.IsPrimary) != null ? s.Readings.FirstOrDefault(r => r.IsPrimary)!.ReadingText : s.Readings.FirstOrDefault() != null ? s.Readings.FirstOrDefault()!.ReadingText : null,
                SrsStage.Initiate,
                true,
                s.LessonPosition
            ))
            .ToListAsync();

        int radCount = finalSubjects.Count(s => s.Type == SubjectType.Radical);
        int kanCount = finalSubjects.Count(s => s.Type == SubjectType.Kanji);
        int vocCount = finalSubjects.Count(s => s.Type == SubjectType.Vocabulary);

        _logService?.LogInfo("CURRICULUM_PIPELINE", $"Level {level} generated and published successfully ({finalSubjects.Count} subjects).");

        return new LevelGenerationResultDto(
            Level: level,
            Success: true,
            Message: $"Level {level} published with {radCount} Radicals, {kanCount} Kanji, and {vocCount} Vocabulary.",
            SubjectCount: finalSubjects.Count,
            RadicalCount: radCount,
            KanjiCount: kanCount,
            VocabCount: vocCount,
            Subjects: finalSubjects,
            ValidationNotes: validation.Warnings
        );
    }

    public async Task<ResetLevelResult> ResetLevelAsync(int level)
    {
        int safeLevel = Math.Clamp(level, 1, 60);
        _logService?.LogWarning("CURRICULUM_RESET", $"Admin requested reset of all curriculum subjects for Level {safeLevel}");

        var subjects = await _context.Subjects
            .Where(s => s.Level == safeLevel)
            .ToListAsync();

        if (subjects.Count == 0)
        {
            return new ResetLevelResult(
                Success: true,
                Level: safeLevel,
                DeletedSubjectsCount: 0,
                DeletedDependenciesCount: 0,
                DeletedSrsItemsCount: 0,
                Message: $"No subjects found on Level {safeLevel} to reset."
            );
        }

        var subjectIds = subjects.Select(s => s.Id).ToList();

        // 1. Remove dependencies where subjects on this level are parent OR child
        var deps = await _context.SubjectDependencies
            .Where(d => subjectIds.Contains(d.ParentSubjectId) || subjectIds.Contains(d.ChildSubjectId))
            .ToListAsync();
        _context.SubjectDependencies.RemoveRange(deps);

        // 2. Remove SRS Items and Reviews
        var srs = await _context.SrsItems
            .Where(s => subjectIds.Contains(s.SubjectId))
            .ToListAsync();
        _context.SrsItems.RemoveRange(srs);

        var reviews = await _context.Reviews
            .Where(r => subjectIds.Contains(r.SubjectId))
            .ToListAsync();
        _context.Reviews.RemoveRange(reviews);

        // 3. Remove child collections (Meanings, Readings, Mnemonics, ExampleSentences)
        var meanings = await _context.Meanings.Where(m => subjectIds.Contains(m.SubjectId)).ToListAsync();
        _context.Meanings.RemoveRange(meanings);

        var readings = await _context.Readings.Where(r => subjectIds.Contains(r.SubjectId)).ToListAsync();
        _context.Readings.RemoveRange(readings);

        var mnemonics = await _context.Mnemonics.Where(m => subjectIds.Contains(m.SubjectId)).ToListAsync();
        _context.Mnemonics.RemoveRange(mnemonics);

        var sentences = await _context.ExampleSentences.Where(e => subjectIds.Contains(e.SubjectId)).ToListAsync();
        _context.ExampleSentences.RemoveRange(sentences);

        // 4. Remove pending AI generated content for this level
        var pendingAi = await _context.AiGeneratedContents
            .Where(a => subjects.Select(s => s.Character).Contains(a.TargetCharacter))
            .ToListAsync();
        _context.AiGeneratedContents.RemoveRange(pendingAi);

        // 5. Remove the subjects themselves
        _context.Subjects.RemoveRange(subjects);

        await _context.SaveChangesAsync();

        _logService?.LogWarning("CURRICULUM_RESET", $"Reset Level {safeLevel}: deleted {subjects.Count} subjects, {deps.Count} dependencies, and {srs.Count} SRS items.");

        return new ResetLevelResult(
            Success: true,
            Level: safeLevel,
            DeletedSubjectsCount: subjects.Count,
            DeletedDependenciesCount: deps.Count,
            DeletedSrsItemsCount: srs.Count,
            Message: $"Successfully wiped curriculum for Level {safeLevel} ({subjects.Count} subjects removed)."
        );
    }
}
