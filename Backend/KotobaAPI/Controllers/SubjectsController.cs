using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.DataAccess.Entities;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SubjectsController : ControllerBase
{
    private readonly KotobaDbContext _context;
    private readonly IAiContentGenerator _aiGenerator;
    private readonly IProgressionService _progressionService;
    private readonly ISystemLogService _logService;
    private readonly ICurriculumPipelineService _pipelineService;

    public SubjectsController(
        KotobaDbContext context,
        IAiContentGenerator aiGenerator,
        IProgressionService progressionService,
        ISystemLogService logService,
        ICurriculumPipelineService pipelineService)
    {
        _context = context;
        _aiGenerator = aiGenerator;
        _progressionService = progressionService;
        _logService = logService;
        _pipelineService = pipelineService;
    }

    [HttpGet]
    public async Task<ActionResult<List<SubjectSummaryDto>>> GetSubjects(
        [FromQuery] SubjectType? type = null,
        [FromQuery] int? level = null)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int userId = int.TryParse(userIdStr, out int uid) ? uid : 0;
        bool isAdmin = User.IsInRole("Admin");

        var query = _context.Subjects
            .Include(s => s.Meanings)
            .Include(s => s.Readings)
            .AsNoTracking();

        if (type.HasValue)
        {
            query = query.Where(s => s.Type == type.Value);
        }

        if (level.HasValue)
        {
            query = query.Where(s => s.Level == level.Value);
        }

        var subjects = await query
            .OrderBy(s => s.Level)
            .ThenBy(s => s.LessonPosition)
            .ThenBy(s => s.Type)
            .ThenBy(s => s.Id)
            .ToListAsync();

        var userSrs = isAdmin
            ? new Dictionary<int, SrsStage>()
            : await _context.SrsItems
                .Where(s => s.UserId == userId)
                .ToDictionaryAsync(s => s.SubjectId, s => s.Stage);

        var result = subjects.Select(s =>
        {
            var isUnlocked = isAdmin || userSrs.TryGetValue(s.Id, out var stage);
            var actualStage = isAdmin ? SrsStage.Initiate : (isUnlocked ? userSrs[s.Id] : SrsStage.Locked);
            return new SubjectSummaryDto(
                Id: s.Id,
                Character: s.Character,
                Type: s.Type,
                Level: s.Level,
                PrimaryMeaning: s.Meanings.FirstOrDefault(m => m.IsPrimary)?.MeaningText ?? s.Meanings.FirstOrDefault()?.MeaningText ?? "Unknown",
                PrimaryReading: s.Readings.FirstOrDefault(r => r.IsPrimary)?.ReadingText ?? s.Readings.FirstOrDefault()?.ReadingText,
                Stage: actualStage,
                IsUnlocked: isUnlocked,
                LessonPosition: s.LessonPosition
            );
        }).ToList();

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SubjectDetailDto>> GetSubjectDetail(int id)
    {
        var subject = await _context.Subjects
            .Include(s => s.Meanings)
            .Include(s => s.Readings)
            .Include(s => s.Mnemonics)
            .Include(s => s.ExampleSentences)
            .Include(s => s.ParentDependencies)
                .ThenInclude(d => d.ParentSubject)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id);

        if (subject == null)
            return NotFound();

        var dto = new SubjectDetailDto(
            Id: subject.Id,
            Character: subject.Character,
            Type: subject.Type,
            Level: subject.Level,
            MeaningHint: subject.MeaningHint,
            ReadingHint: subject.ReadingHint,
            Meanings: subject.Meanings.Select(m => new MeaningDto(m.Id, m.MeaningText, m.IsPrimary, m.AcceptedAlternatives)).ToList(),
            Readings: subject.Readings.Select(r => new ReadingDto(r.Id, r.ReadingText, r.Type, r.IsPrimary, r.AcceptedAlternatives)).ToList(),
            Mnemonics: subject.Mnemonics.Select(m => new MnemonicDto(m.Id, m.Type, m.Text, m.Hint)).ToList(),
            ExampleSentences: subject.ExampleSentences.Select(e => new ExampleSentenceDto(e.Id, e.Japanese, e.English, e.Furigana)).ToList(),
            ComponentCharacters: subject.ParentDependencies.Where(d => d.ParentSubject != null).Select(d => d.ParentSubject.Character).Distinct().ToList(),
            LessonPosition: subject.LessonPosition
        );

        return Ok(dto);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("level/{level:int}")]
    public async Task<ActionResult<ResetLevelResult>> ResetLevel(int level)
    {
        var result = await _pipelineService.ResetLevelAsync(level);
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<SubjectDetailDto>> CreateSubject([FromBody] CreateSubjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Character))
            return BadRequest(new { message = "Character cannot be empty." });

        var exists = await _context.Subjects.AnyAsync(s => s.Character == request.Character.Trim() && s.Type == request.Type);
        if (exists)
            return Conflict(new { message = $"A {request.Type} with character '{request.Character}' already exists in the deck." });

        var subject = new Subject
        {
            Character = request.Character.Trim(),
            Type = request.Type,
            Level = Math.Clamp(request.Level, 1, 60),
            MeaningHint = request.MeaningHint?.Trim(),
            ReadingHint = request.ReadingHint?.Trim()
        };

        if (request.Meanings != null && request.Meanings.Count > 0)
        {
            foreach (var m in request.Meanings.Where(m => !string.IsNullOrWhiteSpace(m.MeaningText)))
            {
                subject.Meanings.Add(new Meaning
                {
                    MeaningText = m.MeaningText.Trim(),
                    IsPrimary = m.IsPrimary,
                    AcceptedAlternatives = m.AcceptedAlternatives?.Trim()
                });
            }
        }

        if (subject.Meanings.Count == 0)
        {
            subject.Meanings.Add(new Meaning { MeaningText = "Primary Meaning", IsPrimary = true });
        }
        else if (!subject.Meanings.Any(m => m.IsPrimary))
        {
            subject.Meanings.First().IsPrimary = true;
        }

        if (request.Type != SubjectType.Radical && request.Readings != null)
        {
            foreach (var r in request.Readings.Where(r => !string.IsNullOrWhiteSpace(r.ReadingText)))
            {
                subject.Readings.Add(new Reading
                {
                    ReadingText = r.ReadingText.Trim(),
                    Type = r.Type,
                    IsPrimary = r.IsPrimary,
                    AcceptedAlternatives = r.AcceptedAlternatives?.Trim()
                });
            }
            if (subject.Readings.Count > 0 && !subject.Readings.Any(r => r.IsPrimary))
            {
                subject.Readings.First().IsPrimary = true;
            }
        }

        if (request.Mnemonics != null)
        {
            foreach (var mn in request.Mnemonics.Where(m => !string.IsNullOrWhiteSpace(m.Text)))
            {
                subject.Mnemonics.Add(new Mnemonic
                {
                    Type = mn.Type,
                    Text = mn.Text.Trim(),
                    Hint = mn.Hint?.Trim()
                });
            }
        }

        if (request.ExampleSentences != null)
        {
            foreach (var es in request.ExampleSentences.Where(e => !string.IsNullOrWhiteSpace(e.Japanese)))
            {
                subject.ExampleSentences.Add(new ExampleSentence
                {
                    Japanese = es.Japanese.Trim(),
                    English = es.English.Trim(),
                    Furigana = es.Furigana?.Trim()
                });
            }
        }

        _context.Subjects.Add(subject);
        await _context.SaveChangesAsync();

        // Attach component dependencies
        if (request.ComponentCharacters != null && request.ComponentCharacters.Count > 0)
        {
            var componentSubjects = await _context.Subjects
                .Where(s => request.ComponentCharacters.Contains(s.Character))
                .ToListAsync();

            foreach (var parent in componentSubjects)
            {
                _context.SubjectDependencies.Add(new SubjectDependency
                {
                    ParentSubjectId = parent.Id,
                    ChildSubjectId = subject.Id,
                    DependencyType = subject.Type == SubjectType.Vocabulary ? DependencyType.VocabularyKanji : DependencyType.Component
                });
            }
            await _context.SaveChangesAsync();
        }

        // Auto unlock for existing active learners at or above this level
        var usersOnLevel = await _context.Users.Where(u => u.CurrentLevel >= subject.Level).Select(u => u.Id).ToListAsync();
        foreach (var uId in usersOnLevel)
        {
            await _progressionService.UnlockInitialSubjectsForUserAsync(uId, subject.Level);
        }

        _logService.LogInfo("DECK", $"Admin created new {subject.Type} '{subject.Character}' (Level {subject.Level})", method: "POST", endpoint: "/api/subjects", user: User.Identity?.Name);

        return await GetSubjectDetail(subject.Id);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<SubjectDetailDto>> UpdateSubject(int id, [FromBody] UpdateSubjectRequest request)
    {
        var subject = await _context.Subjects
            .Include(s => s.Meanings)
            .Include(s => s.Readings)
            .Include(s => s.Mnemonics)
            .Include(s => s.ExampleSentences)
            .Include(s => s.ParentDependencies)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (subject == null)
            return NotFound(new { message = $"Subject ID {id} not found." });

        subject.Character = request.Character.Trim();
        subject.Type = request.Type;
        subject.Level = Math.Clamp(request.Level, 1, 60);
        subject.MeaningHint = request.MeaningHint?.Trim();
        subject.ReadingHint = request.ReadingHint?.Trim();

        // Replace Meanings
        _context.Meanings.RemoveRange(subject.Meanings);
        if (request.Meanings != null && request.Meanings.Count > 0)
        {
            foreach (var m in request.Meanings.Where(m => !string.IsNullOrWhiteSpace(m.MeaningText)))
            {
                subject.Meanings.Add(new Meaning
                {
                    MeaningText = m.MeaningText.Trim(),
                    IsPrimary = m.IsPrimary,
                    AcceptedAlternatives = m.AcceptedAlternatives?.Trim()
                });
            }
        }
        if (subject.Meanings.Count > 0 && !subject.Meanings.Any(m => m.IsPrimary))
        {
            subject.Meanings.First().IsPrimary = true;
        }

        // Replace Readings
        _context.Readings.RemoveRange(subject.Readings);
        if (request.Type != SubjectType.Radical && request.Readings != null)
        {
            foreach (var r in request.Readings.Where(r => !string.IsNullOrWhiteSpace(r.ReadingText)))
            {
                subject.Readings.Add(new Reading
                {
                    ReadingText = r.ReadingText.Trim(),
                    Type = r.Type,
                    IsPrimary = r.IsPrimary,
                    AcceptedAlternatives = r.AcceptedAlternatives?.Trim()
                });
            }
            if (subject.Readings.Count > 0 && !subject.Readings.Any(r => r.IsPrimary))
            {
                subject.Readings.First().IsPrimary = true;
            }
        }

        // Replace Mnemonics
        _context.Mnemonics.RemoveRange(subject.Mnemonics);
        if (request.Mnemonics != null)
        {
            foreach (var mn in request.Mnemonics.Where(m => !string.IsNullOrWhiteSpace(m.Text)))
            {
                subject.Mnemonics.Add(new Mnemonic
                {
                    Type = mn.Type,
                    Text = mn.Text.Trim(),
                    Hint = mn.Hint?.Trim()
                });
            }
        }

        // Replace Example Sentences
        _context.ExampleSentences.RemoveRange(subject.ExampleSentences);
        if (request.ExampleSentences != null)
        {
            foreach (var es in request.ExampleSentences.Where(e => !string.IsNullOrWhiteSpace(e.Japanese)))
            {
                subject.ExampleSentences.Add(new ExampleSentence
                {
                    Japanese = es.Japanese.Trim(),
                    English = es.English.Trim(),
                    Furigana = es.Furigana?.Trim()
                });
            }
        }

        // Replace component dependencies
        _context.SubjectDependencies.RemoveRange(subject.ParentDependencies);
        if (request.ComponentCharacters != null && request.ComponentCharacters.Count > 0)
        {
            var componentSubjects = await _context.Subjects
                .Where(s => request.ComponentCharacters.Contains(s.Character))
                .ToListAsync();

            foreach (var parent in componentSubjects)
            {
                _context.SubjectDependencies.Add(new SubjectDependency
                {
                    ParentSubjectId = parent.Id,
                    ChildSubjectId = subject.Id,
                    DependencyType = subject.Type == SubjectType.Vocabulary ? DependencyType.VocabularyKanji : DependencyType.Component
                });
            }
        }

        await _context.SaveChangesAsync();

        _logService.LogInfo("DECK", $"Admin updated {subject.Type} '{subject.Character}' (ID: {id})", method: "PUT", endpoint: $"/api/subjects/{id}", user: User.Identity?.Name);

        return await GetSubjectDetail(subject.Id);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:int}")]
    public async Task<ActionResult> DeleteSubject(int id)
    {
        var subject = await _context.Subjects.FindAsync(id);
        if (subject == null)
            return NotFound(new { message = $"Subject ID {id} not found." });

        // Clean up dependencies where this subject is parent or child
        var deps = await _context.SubjectDependencies
            .Where(d => d.ParentSubjectId == id || d.ChildSubjectId == id)
            .ToListAsync();
        _context.SubjectDependencies.RemoveRange(deps);

        // Remove SrsItems and Reviews
        var srs = await _context.SrsItems.Where(s => s.SubjectId == id).ToListAsync();
        _context.SrsItems.RemoveRange(srs);

        var reviews = await _context.Reviews.Where(r => r.SubjectId == id).ToListAsync();
        _context.Reviews.RemoveRange(reviews);

        var character = subject.Character;
        var type = subject.Type;

        _context.Subjects.Remove(subject);
        await _context.SaveChangesAsync();

        _logService.LogWarning("DECK", $"Admin deleted {type} '{character}' (ID: {id}) from central deck", method: "DELETE", endpoint: $"/api/subjects/{id}", user: User.Identity?.Name);

        return Ok(new { success = true, message = $"Deleted '{character}' ({type}) from central deck." });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("quick-generate")]
    public async Task<ActionResult> QuickGenerateSubject([FromBody] QuickGenerateSubjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Character))
            return BadRequest(new { message = "Character cannot be empty." });

        var (success, json, error) = await _aiGenerator.GenerateSingleRawJsonAsync(request.Type, request.Character.Trim(), request.Level);
        if (!success)
            return StatusCode(500, new { message = error ?? "Failed to generate AI subject content." });

        try
        {
            var parsed = JsonSerializer.Deserialize<JsonElement>(json);
            return Ok(parsed);
        }
        catch
        {
            return Ok(new { rawJson = json });
        }
    }
}
