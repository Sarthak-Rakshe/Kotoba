using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class ReviewService : IReviewService
{
    private readonly KotobaDbContext _context;

    public ReviewService(KotobaDbContext context)
    {
        _context = context;
    }

    public async Task<List<ReviewQueueItemDto>> GetReviewQueueAsync(int userId, int limit = 50)
    {
        var now = DateTime.UtcNow;

        var dueItems = await _context.SrsItems
            .Where(s => s.UserId == userId &&
                        s.Stage >= SrsStage.Apprentice1 &&
                        s.Stage < SrsStage.Burned &&
                        s.AvailableAt != null &&
                        s.AvailableAt <= now)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Meanings)
            .Include(s => s.Subject)
                .ThenInclude(sub => sub.Readings)
            .OrderBy(s => s.AvailableAt)
            .Take(limit)
            .ToListAsync();

        var queue = new List<ReviewQueueItemDto>();

        foreach (var item in dueItems)
        {
            var acceptedMeanings = item.Subject.Meanings
                .Select(m => m.MeaningText)
                .Concat(item.Subject.Meanings
                    .Where(m => !string.IsNullOrEmpty(m.AcceptedAlternatives))
                    .SelectMany(m => m.AcceptedAlternatives!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
                .Distinct()
                .ToList();

            var acceptedReadings = item.Subject.Readings
                .Select(r => r.ReadingText)
                .Concat(item.Subject.Readings
                    .Where(r => !string.IsNullOrEmpty(r.AcceptedAlternatives))
                    .SelectMany(r => r.AcceptedAlternatives!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
                .Distinct()
                .ToList();

            // Radicals only have meaning reviews
            queue.Add(new ReviewQueueItemDto(
                SrsItemId: item.Id,
                SubjectId: item.SubjectId,
                Character: item.Subject.Character,
                Type: item.Subject.Type,
                Level: item.Subject.Level,
                ReviewType: ReviewType.Meaning,
                AcceptedMeanings: acceptedMeanings,
                AcceptedReadings: acceptedReadings
            ));

            // Kanji and Vocabulary also have reading reviews
            if (item.Subject.Type != SubjectType.Radical && acceptedReadings.Any())
            {
                queue.Add(new ReviewQueueItemDto(
                    SrsItemId: item.Id,
                    SubjectId: item.SubjectId,
                    Character: item.Subject.Character,
                    Type: item.Subject.Type,
                    Level: item.Subject.Level,
                    ReviewType: ReviewType.Reading,
                    AcceptedMeanings: acceptedMeanings,
                    AcceptedReadings: acceptedReadings
                ));
            }
        }

        // Shuffle slightly so meaning and reading are not always back-to-back
        var rng = new Random();
        return queue.OrderBy(_ => rng.Next()).ToList();
    }

    public async Task<ReviewForecastDto> GetReviewForecastAsync(int userId)
    {
        var now = DateTime.UtcNow;

        var activeItems = await _context.SrsItems
            .Where(s => s.UserId == userId &&
                        s.Stage >= SrsStage.Apprentice1 &&
                        s.Stage < SrsStage.Burned &&
                        s.AvailableAt != null)
            .ToListAsync();

        int dueNow = activeItems.Count(s => s.AvailableAt <= now);

        // Next 24 hours: hourly increments
        var hourlyList = new List<HourlyForecastItem>();
        var currentHourCeiling = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc).AddHours(1);

        int runningCumulative = dueNow;

        for (int i = 0; i < 24; i++)
        {
            var targetHour = currentHourCeiling.AddHours(i);
            var prevHour = (i == 0) ? now : currentHourCeiling.AddHours(i - 1);

            int countInHour = activeItems.Count(s => s.AvailableAt > prevHour && s.AvailableAt <= targetHour);
            runningCumulative += countInHour;

            hourlyList.Add(new HourlyForecastItem(
                TimeLabel: targetHour.ToLocalTime().ToString("h tt"),
                Timestamp: targetHour,
                Count: countInHour,
                CumulativeCount: runningCumulative
            ));
        }

        // Next 7 days
        var dailyList = new List<DailyForecastItem>();
        var startOfToday = DateTime.UtcNow.Date;

        for (int d = 0; d < 7; d++)
        {
            var dayStart = startOfToday.AddDays(d);
            var dayEnd = dayStart.AddDays(1);

            int dayCount = activeItems.Count(s => s.AvailableAt >= dayStart && s.AvailableAt < dayEnd);
            string dayLabel = d == 0 ? "Today" : (d == 1 ? "Tomorrow" : dayStart.ToString("ddd"));

            dailyList.Add(new DailyForecastItem(
                DayLabel: dayLabel,
                Date: dayStart,
                Count: dayCount
            ));
        }

        return new ReviewForecastDto(
            DueNow: dueNow,
            Next24Hours: hourlyList,
            Next7Days: dailyList
        );
    }
}
