using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.DataAccess.Entities;
using Kotoba.Utility.Enums;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class ProgressionService : IProgressionService
{
    private readonly KotobaDbContext _context;

    public ProgressionService(KotobaDbContext context)
    {
        _context = context;
    }

    public async Task UnlockInitialSubjectsForUserAsync(int userId, int level = 1)
    {
        // Find radicals of this level that do not have parent dependencies
        var independentRadicals = await _context.Subjects
            .Where(s => s.Level == level && s.Type == SubjectType.Radical)
            .Where(s => !s.ParentDependencies.Any())
            .ToListAsync();

        var existingSrsSubjectIds = await _context.SrsItems
            .Where(s => s.UserId == userId)
            .Select(s => s.SubjectId)
            .ToHashSetAsync();

        var newItems = new List<SrsItem>();
        foreach (var rad in independentRadicals)
        {
            if (!existingSrsSubjectIds.Contains(rad.Id))
            {
                newItems.Add(new SrsItem
                {
                    UserId = userId,
                    SubjectId = rad.Id,
                    Stage = SrsStage.Initiate,
                    UnlockedAt = DateTime.UtcNow
                });
            }
        }

        if (newItems.Any())
        {
            _context.SrsItems.AddRange(newItems);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<List<string>> CheckAndUnlockDependentSubjectsAsync(int userId, int completedSubjectId)
    {
        var newlyUnlocked = new List<string>();

        // Find all subjects that depend on completedSubjectId
        var candidateDependencies = await _context.SubjectDependencies
            .Where(d => d.ParentSubjectId == completedSubjectId)
            .Include(d => d.ChildSubject)
            .ToListAsync();

        var childSubjectIds = candidateDependencies.Select(d => d.ChildSubjectId).Distinct().ToList();

        // Get user's existing Srs items
        var existingUserSrsItems = await _context.SrsItems
            .Where(s => s.UserId == userId)
            .ToDictionaryAsync(s => s.SubjectId);

        foreach (var childId in childSubjectIds)
        {
            // If user already unlocked this item, skip
            if (existingUserSrsItems.ContainsKey(childId))
                continue;

            // Get all prerequisites for this child
            var allPrereqParentIds = await _context.SubjectDependencies
                .Where(d => d.ChildSubjectId == childId)
                .Select(d => d.ParentSubjectId)
                .ToListAsync();

            // Check if user has passed all prerequisites (Stage >= Guru1)
            bool allPassed = allPrereqParentIds.All(parentId =>
                existingUserSrsItems.TryGetValue(parentId, out var parentSrs) &&
                parentSrs.Stage >= SrsStage.Guru1);

            if (allPassed)
            {
                var childSubject = candidateDependencies.First(d => d.ChildSubjectId == childId).ChildSubject;
                var newItem = new SrsItem
                {
                    UserId = userId,
                    SubjectId = childId,
                    Stage = SrsStage.Initiate,
                    UnlockedAt = DateTime.UtcNow
                };

                _context.SrsItems.Add(newItem);
                existingUserSrsItems[childId] = newItem;
                newlyUnlocked.Add(childSubject.Character);
            }
        }

        if (newlyUnlocked.Any())
        {
            await _context.SaveChangesAsync();
        }

        return newlyUnlocked;
    }

    public async Task<(bool LeveledUp, int NewLevel)> CheckLevelProgressionAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return (false, 0);

        int currentLevel = user.CurrentLevel;

        // Get all Kanji for current level
        var levelKanjiIds = await _context.Subjects
            .Where(s => s.Level == currentLevel && s.Type == SubjectType.Kanji)
            .Select(s => s.Id)
            .ToListAsync();

        if (!levelKanjiIds.Any()) return (false, currentLevel);

        // Count how many of these kanji are passed (Guru1+) by the user
        var passedKanjiCount = await _context.SrsItems
            .Where(s => s.UserId == userId && levelKanjiIds.Contains(s.SubjectId) && s.Stage >= SrsStage.Guru1)
            .CountAsync();

        double passingRatio = (double)passedKanjiCount / levelKanjiIds.Count;

        // Standard 90% threshold for level up
        if (passingRatio >= 0.90)
        {
            user.CurrentLevel++;
            await _context.SaveChangesAsync();

            // Unlock next level's radicals
            await UnlockInitialSubjectsForUserAsync(userId, user.CurrentLevel);

            return (true, user.CurrentLevel);
        }

        return (false, currentLevel);
    }
}
