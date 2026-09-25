using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class CurriculumContextService : ICurriculumContextService
{
    private readonly KotobaDbContext _context;

    public CurriculumContextService(KotobaDbContext context)
    {
        _context = context;
    }

    public async Task<CurriculumContext> BuildContextAsync(int currentLevel)
    {
        int safeLevel = Math.Clamp(currentLevel, 1, 60);

        if (safeLevel <= 1)
        {
            // Level 1 has no previous curriculum
            return new CurriculumContext(
                CurrentLevel: 1,
                KnownComponents: new List<string>(),
                KnownKanji: new List<string>(),
                KnownVocabulary: new List<string>(),
                KnownReadings: new List<string>(),
                RecentSubjects: new List<CompactSubjectDto>(),
                RecentKanji: new List<string>(),
                ExistingDependencies: new List<CompactDependencyDto>()
            );
        }

        // Fetch all previous level subjects (levels 1 through currentLevel - 1)
        var previousSubjects = await _context.Subjects
            .Where(s => s.Level < safeLevel)
            .Include(s => s.Meanings)
            .Include(s => s.Readings)
            .AsNoTracking()
            .ToListAsync();

        var knownComponents = previousSubjects
            .Where(s => s.Type == SubjectType.Radical)
            .Select(s => s.Character)
            .Distinct()
            .OrderBy(c => c)
            .ToList();

        var knownKanji = previousSubjects
            .Where(s => s.Type == SubjectType.Kanji)
            .Select(s => s.Character)
            .Distinct()
            .OrderBy(c => c)
            .ToList();

        var knownVocabulary = previousSubjects
            .Where(s => s.Type == SubjectType.Vocabulary)
            .Select(s => s.Character)
            .Distinct()
            .OrderBy(c => c)
            .ToList();

        var knownReadings = previousSubjects
            .Where(s => s.Type == SubjectType.Kanji)
            .SelectMany(s => s.Readings)
            .Select(r => r.ReadingText)
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Distinct()
            .OrderBy(r => r)
            .ToList();

        // Recent levels (typically currentLevel - 2 and currentLevel - 1) to maintain pedagogical continuity
        int recentLevelStart = Math.Max(1, safeLevel - 2);
        var recentSubjects = previousSubjects
            .Where(s => s.Level >= recentLevelStart)
            .OrderByDescending(s => s.Level)
            .ThenBy(s => s.LessonPosition)
            .Select(s => new CompactSubjectDto(
                Character: s.Character,
                Type: s.Type,
                Level: s.Level,
                PrimaryMeaning: s.Meanings.FirstOrDefault(m => m.IsPrimary)?.MeaningText ?? s.Meanings.FirstOrDefault()?.MeaningText ?? "",
                PrimaryReading: s.Readings.FirstOrDefault(r => r.IsPrimary)?.ReadingText ?? s.Readings.FirstOrDefault()?.ReadingText
            ))
            .Take(30)
            .ToList();

        var recentKanji = recentSubjects
            .Where(s => s.Type == SubjectType.Kanji)
            .Select(s => s.Character)
            .Distinct()
            .ToList();

        // Fetch sample of existing dependencies for structural reference
        var previousIds = previousSubjects.Select(s => s.Id).ToHashSet();
        var existingDependencies = await _context.SubjectDependencies
            .Where(d => previousIds.Contains(d.ChildSubjectId))
            .Include(d => d.ParentSubject)
            .Include(d => d.ChildSubject)
            .AsNoTracking()
            .Take(40)
            .Select(d => new CompactDependencyDto(
                ParentCharacter: d.ParentSubject.Character,
                ChildCharacter: d.ChildSubject.Character,
                Type: d.DependencyType
            ))
            .ToListAsync();

        return new CurriculumContext(
            CurrentLevel: safeLevel,
            KnownComponents: knownComponents,
            KnownKanji: knownKanji,
            KnownVocabulary: knownVocabulary,
            KnownReadings: knownReadings,
            RecentSubjects: recentSubjects,
            RecentKanji: recentKanji,
            ExistingDependencies: existingDependencies
        );
    }
}
