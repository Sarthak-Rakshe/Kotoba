using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class DashboardService : IDashboardService
{
    private readonly KotobaDbContext _context;

    public DashboardService(KotobaDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync(int userId)
    {
        var now = DateTime.UtcNow;
        var startOfToday = DateTime.UtcNow.Date;

        var user = await _context.Users.FindAsync(userId);
        int currentLevel = user?.CurrentLevel ?? 1;

        // User SRS items
        var userSrs = await _context.SrsItems
            .Where(s => s.UserId == userId)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Meanings)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Readings)
            .ToListAsync();

        int lessonsAvailable = userSrs.Count(s => s.Stage == SrsStage.Initiate);
        int reviewsAvailable = userSrs.Count(s => s.Stage >= SrsStage.Apprentice1 && s.Stage < SrsStage.Burned && s.AvailableAt != null && s.AvailableAt <= now);

        int totalLearned = userSrs.Count(s => s.Stage >= SrsStage.Apprentice1);
        int radicalsLearned = userSrs.Count(s => s.Stage >= SrsStage.Apprentice1 && s.Subject.Type == SubjectType.Radical);
        int kanjiLearned = userSrs.Count(s => s.Stage >= SrsStage.Apprentice1 && s.Subject.Type == SubjectType.Kanji);
        int vocabLearned = userSrs.Count(s => s.Stage >= SrsStage.Apprentice1 && s.Subject.Type == SubjectType.Vocabulary);

        // SRS distribution
        int lockedCount = await _context.Subjects.CountAsync() - userSrs.Count;
        if (lockedCount < 0) lockedCount = 0;

        int initiateCount = userSrs.Count(s => s.Stage == SrsStage.Initiate);
        int apprenticeCount = userSrs.Count(s => s.Stage >= SrsStage.Apprentice1 && s.Stage <= SrsStage.Apprentice4);
        int guruCount = userSrs.Count(s => s.Stage >= SrsStage.Guru1 && s.Stage <= SrsStage.Guru2);
        int masterCount = userSrs.Count(s => s.Stage == SrsStage.Master);
        int enlightenedCount = userSrs.Count(s => s.Stage == SrsStage.Enlightened);
        int burnedCount = userSrs.Count(s => s.Stage == SrsStage.Burned);

        // Current level kanji progress
        var currentLevelKanji = await _context.Subjects
            .Where(s => s.Level == currentLevel && s.Type == SubjectType.Kanji)
            .Select(s => s.Id)
            .ToListAsync();

        int levelProgressPercentage = 0;
        if (currentLevelKanji.Any())
        {
            int passedKanji = userSrs.Count(s => currentLevelKanji.Contains(s.SubjectId) && s.Stage >= SrsStage.Guru1);
            levelProgressPercentage = (int)Math.Round((double)passedKanji / currentLevelKanji.Count * 100);
        }

        // Today's reviews and accuracy
        var todayReviews = await _context.Reviews
            .Where(r => r.UserId == userId && r.ReviewedAt >= startOfToday)
            .ToListAsync();

        int todayReviewsCount = todayReviews.Count;
        double accuracyRate = 100.0;
        if (todayReviewsCount > 0)
        {
            accuracyRate = Math.Round((double)todayReviews.Count(r => r.IsCorrect) / todayReviewsCount * 100, 1);
        }

        // Recent subjects learned/reviewed
        var recentSubjects = userSrs
            .Where(s => s.Stage >= SrsStage.Apprentice1)
            .OrderByDescending(s => s.LastReviewedAt ?? s.UnlockedAt)
            .Take(8)
            .Select(s => new SubjectSummaryDto(
                Id: s.SubjectId,
                Character: s.Subject.Character,
                Type: s.Subject.Type,
                Level: s.Subject.Level,
                PrimaryMeaning: s.Subject.Meanings.FirstOrDefault(m => m.IsPrimary)?.MeaningText ?? s.Subject.Meanings.FirstOrDefault()?.MeaningText ?? "Unknown",
                PrimaryReading: s.Subject.Readings.FirstOrDefault(r => r.IsPrimary)?.ReadingText ?? s.Subject.Readings.FirstOrDefault()?.ReadingText,
                Stage: s.Stage,
                IsUnlocked: true
            ))
            .ToList();

        return new DashboardStatsDto(
            CurrentLevel: currentLevel,
            LevelProgressPercentage: levelProgressPercentage,
            LessonsAvailable: lessonsAvailable,
            ReviewsAvailable: reviewsAvailable,
            TotalLearned: totalLearned,
            RadicalsLearned: radicalsLearned,
            KanjiLearned: kanjiLearned,
            VocabularyLearned: vocabLearned,
            TodayReviewsCount: todayReviewsCount,
            AccuracyRate: accuracyRate,
            SrsDistribution: new SrsDistributionDto(
                Locked: lockedCount,
                Initiate: initiateCount,
                Apprentice: apprenticeCount,
                Guru: guruCount,
                Master: masterCount,
                Enlightened: enlightenedCount,
                Burned: burnedCount
            ),
            RecentSubjects: recentSubjects
        );
    }

    public async Task<AdminDeckStatsDto> GetAdminDeckStatsAsync()
    {
        var totalSubjects = await _context.Subjects.CountAsync();
        var totalRadicals = await _context.Subjects.CountAsync(s => s.Type == SubjectType.Radical);
        var totalKanji = await _context.Subjects.CountAsync(s => s.Type == SubjectType.Kanji);
        var totalVocab = await _context.Subjects.CountAsync(s => s.Type == SubjectType.Vocabulary);
        var totalLevels = await _context.Levels.CountAsync();
        var pendingAi = await _context.AiGeneratedContents.CountAsync(a => a.Status == AiContentStatus.Pending || a.Status == AiContentStatus.NeedsReview);
        var totalLearners = await _context.Users.CountAsync(u => !u.IsAdmin);

        var subjectsByLevel = await _context.Subjects
            .GroupBy(s => s.Level)
            .Select(g => new
            {
                Level = g.Key,
                Radicals = g.Count(s => s.Type == SubjectType.Radical),
                Kanji = g.Count(s => s.Type == SubjectType.Kanji),
                Vocab = g.Count(s => s.Type == SubjectType.Vocabulary),
                Total = g.Count()
            })
            .OrderBy(l => l.Level)
            .ToListAsync();

        var levelDist = subjectsByLevel.Select(l => new AdminLevelDistributionDto(
            Level: l.Level,
            RadicalsCount: l.Radicals,
            KanjiCount: l.Kanji,
            VocabCount: l.Vocab,
            TotalCount: l.Total
        )).ToList();

        var recentSubjects = await _context.Subjects
            .Include(s => s.Meanings)
            .Include(s => s.Readings)
            .OrderByDescending(s => s.Id)
            .Take(12)
            .Select(s => new SubjectSummaryDto(
                Id: s.Id,
                Character: s.Character,
                Type: s.Type,
                Level: s.Level,
                PrimaryMeaning: s.Meanings.FirstOrDefault(m => m.IsPrimary)!.MeaningText ?? s.Meanings.FirstOrDefault()!.MeaningText ?? "Unknown",
                PrimaryReading: s.Readings.FirstOrDefault(r => r.IsPrimary)!.ReadingText ?? s.Readings.FirstOrDefault()!.ReadingText,
                Stage: SrsStage.Initiate,
                IsUnlocked: true
            ))
            .ToListAsync();

        return new AdminDeckStatsDto(
            TotalSubjects: totalSubjects,
            TotalRadicals: totalRadicals,
            TotalKanji: totalKanji,
            TotalVocabulary: totalVocab,
            TotalLevels: totalLevels,
            PendingAiCount: pendingAi,
            TotalLearners: totalLearners,
            LevelDistribution: levelDist,
            RecentSubjects: recentSubjects
        );
    }
}
