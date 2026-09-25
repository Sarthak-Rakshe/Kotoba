using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class LessonService : ILessonService
{
    private readonly KotobaDbContext _context;

    public LessonService(KotobaDbContext context)
    {
        _context = context;
    }

    public async Task<List<LessonItemDto>> GetAvailableLessonsAsync(int userId, int limit = 10)
    {
        var lessonSrsItems = await _context.SrsItems
            .Where(s => s.UserId == userId && s.Stage == SrsStage.Initiate)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Meanings)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Readings)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Mnemonics)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.ExampleSentences)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.ParentDependencies)
                    .ThenInclude(dep => dep.ParentSubject)
            .OrderBy(s => s.Subject.Level)
            .ThenBy(s => s.Subject.Type) // Radicals first, then Kanji, then Vocab
            .ThenBy(s => s.SubjectId)
            .Take(limit)
            .ToListAsync();

        return lessonSrsItems.Select(s => new LessonItemDto(
            SubjectId: s.SubjectId,
            Character: s.Subject.Character,
            Type: s.Subject.Type,
            Level: s.Subject.Level,
            MeaningHint: s.Subject.MeaningHint,
            ReadingHint: s.Subject.ReadingHint,
            Meanings: s.Subject.Meanings.Select(m => new MeaningDto(m.Id, m.MeaningText, m.IsPrimary, m.AcceptedAlternatives)).ToList(),
            Readings: s.Subject.Readings.Select(r => new ReadingDto(r.Id, r.ReadingText, r.Type, r.IsPrimary, r.AcceptedAlternatives)).ToList(),
            Mnemonics: s.Subject.Mnemonics.Select(m => new MnemonicDto(m.Id, m.Type, m.Text, m.Hint)).ToList(),
            ExampleSentences: s.Subject.ExampleSentences.Select(e => new ExampleSentenceDto(e.Id, e.Japanese, e.English, e.Furigana)).ToList(),
            Components: s.Subject.ParentDependencies.Select(d => d.ParentSubject.Character).Distinct().ToList()
        )).ToList();
    }

    public async Task CompleteLessonAsync(int userId, int subjectId)
    {
        var srsItem = await _context.SrsItems
            .FirstOrDefaultAsync(s => s.UserId == userId && s.SubjectId == subjectId && s.Stage == SrsStage.Initiate);

        if (srsItem == null)
            throw new KeyNotFoundException("Lesson item not found or already completed.");

        srsItem.Stage = SrsStage.Apprentice1;
        // Make available immediately for the initial review so learner can practice right away
        srsItem.AvailableAt = DateTime.UtcNow;
        srsItem.LastReviewedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }
}
