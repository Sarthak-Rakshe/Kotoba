using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.DataAccess.Entities;
using Kotoba.Utility.Enums;
using Kotoba.Utility.Helpers;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class SrsService : ISrsService
{
    private readonly KotobaDbContext _context;
    private readonly IProgressionService _progressionService;

    public SrsService(KotobaDbContext context, IProgressionService progressionService)
    {
        _context = context;
        _progressionService = progressionService;
    }

    public DateTime? CalculateNextReviewTime(SrsStage stage)
    {
        return stage switch
        {
            SrsStage.Apprentice1 => DateTime.UtcNow.AddHours(4),
            SrsStage.Apprentice2 => DateTime.UtcNow.AddHours(8),
            SrsStage.Apprentice3 => DateTime.UtcNow.AddHours(23), // ~1 day
            SrsStage.Apprentice4 => DateTime.UtcNow.AddHours(47), // ~2 days
            SrsStage.Guru1 => DateTime.UtcNow.AddDays(7),
            SrsStage.Guru2 => DateTime.UtcNow.AddDays(14),
            SrsStage.Master => DateTime.UtcNow.AddDays(30),
            SrsStage.Enlightened => DateTime.UtcNow.AddDays(120),
            SrsStage.Burned => null,
            _ => DateTime.UtcNow.AddHours(4)
        };
    }

    public SrsStage CalculateNextStage(SrsStage currentStage, bool isCorrect, int incorrectCount = 0)
    {
        if (isCorrect)
        {
            return currentStage switch
            {
                SrsStage.Initiate => SrsStage.Apprentice1,
                SrsStage.Apprentice1 => SrsStage.Apprentice2,
                SrsStage.Apprentice2 => SrsStage.Apprentice3,
                SrsStage.Apprentice3 => SrsStage.Apprentice4,
                SrsStage.Apprentice4 => SrsStage.Guru1,
                SrsStage.Guru1 => SrsStage.Guru2,
                SrsStage.Guru2 => SrsStage.Master,
                SrsStage.Master => SrsStage.Enlightened,
                SrsStage.Enlightened => SrsStage.Burned,
                SrsStage.Burned => SrsStage.Burned,
                _ => SrsStage.Apprentice1
            };
        }

        // On Incorrect:
        return currentStage switch
        {
            SrsStage.Apprentice1 => SrsStage.Apprentice1,
            SrsStage.Apprentice2 => SrsStage.Apprentice1,
            SrsStage.Apprentice3 => SrsStage.Apprentice2,
            SrsStage.Apprentice4 => SrsStage.Apprentice3,
            SrsStage.Guru1 => SrsStage.Apprentice3,
            SrsStage.Guru2 => SrsStage.Apprentice3,
            SrsStage.Master => SrsStage.Apprentice4,
            SrsStage.Enlightened => SrsStage.Guru1,
            SrsStage.Burned => SrsStage.Guru1,
            _ => SrsStage.Apprentice1
        };
    }

    public async Task<SubmitReviewResponse> ProcessReviewAsync(int userId, SubmitReviewRequest request)
    {
        var srsItem = await _context.SrsItems
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Meanings)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Readings)
            .FirstOrDefaultAsync(s => s.Id == request.SrsItemId && s.UserId == userId);

        if (srsItem == null)
            throw new KeyNotFoundException("SRS item not found for user.");

        EvaluationResult evalResult;
        if (request.ReviewType == ReviewType.Meaning)
        {
            var accepted = srsItem.Subject.Meanings
                .Select(m => m.MeaningText)
                .Concat(srsItem.Subject.Meanings
                    .Where(m => !string.IsNullOrEmpty(m.AcceptedAlternatives))
                    .SelectMany(m => m.AcceptedAlternatives!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
                .ToList();

            evalResult = AnswerEvaluationHelper.EvaluateMeaning(request.SubmittedAnswer, accepted);
        }
        else
        {
            var accepted = srsItem.Subject.Readings
                .Select(r => r.ReadingText)
                .Concat(srsItem.Subject.Readings
                    .Where(r => !string.IsNullOrEmpty(r.AcceptedAlternatives))
                    .SelectMany(r => r.AcceptedAlternatives!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
                .ToList();

            evalResult = AnswerEvaluationHelper.EvaluateReading(request.SubmittedAnswer, accepted);
        }

        var prevStage = srsItem.Stage;
        var newStage = CalculateNextStage(prevStage, evalResult.IsCorrect);
        var nextReviewTime = CalculateNextReviewTime(newStage);

        // Update SrsItem
        srsItem.LastReviewedAt = DateTime.UtcNow;
        srsItem.ReviewCount++;
        srsItem.Stage = newStage;
        srsItem.AvailableAt = nextReviewTime;

        if (evalResult.IsCorrect)
        {
            srsItem.CorrectCount++;
            srsItem.ConsecutiveCorrect++;
            srsItem.ConsecutiveIncorrect = 0;

            if (newStage >= SrsStage.Guru1 && srsItem.PassedAt == null)
            {
                srsItem.PassedAt = DateTime.UtcNow;
            }
            if (newStage == SrsStage.Burned && srsItem.BurnedAt == null)
            {
                srsItem.BurnedAt = DateTime.UtcNow;
            }
        }
        else
        {
            srsItem.IncorrectCount++;
            srsItem.ConsecutiveIncorrect++;
            srsItem.ConsecutiveCorrect = 0;
        }

        // Add Review History
        var review = new Review
        {
            UserId = userId,
            SubjectId = srsItem.SubjectId,
            SrsItemId = srsItem.Id,
            ReviewType = request.ReviewType,
            SubmittedAnswer = request.SubmittedAnswer,
            IsCorrect = evalResult.IsCorrect,
            PreviousStage = prevStage,
            NewStage = newStage,
            ReviewedAt = DateTime.UtcNow,
            ResponseTimeMs = request.ResponseTimeMs
        };
        _context.Reviews.Add(review);
        await _context.SaveChangesAsync();

        // Check if passing this subject unlocks new items
        var unlockedSubjects = new List<string>();
        if (evalResult.IsCorrect && newStage >= SrsStage.Guru1)
        {
            unlockedSubjects = await _progressionService.CheckAndUnlockDependentSubjectsAsync(userId, srsItem.SubjectId);
        }

        // Check level progression
        var (leveledUp, newLevel) = await _progressionService.CheckLevelProgressionAsync(userId);

        return new SubmitReviewResponse(
            IsCorrect: evalResult.IsCorrect,
            HasTypoWarning: evalResult.HasTypoWarning,
            SubmittedAnswer: evalResult.NormalizedAnswer,
            PreviousStage: prevStage,
            NewStage: newStage,
            NextReviewAt: nextReviewTime,
            UnlockedSubjects: unlockedSubjects,
            LeveledUp: leveledUp,
            NewLevel: leveledUp ? newLevel : null
        );
    }
}
