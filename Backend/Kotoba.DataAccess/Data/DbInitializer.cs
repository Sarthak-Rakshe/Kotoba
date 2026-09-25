using Kotoba.DataAccess.Context;
using Kotoba.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;

namespace Kotoba.DataAccess.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(KotobaDbContext context)
    {
        // 1. Ensure database exists
        await context.Database.EnsureCreatedAsync();

        // 2. Ensure schema adjustments (IsAdmin column) and admin roles
        try
        {
            await context.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"IsAdmin\" BOOLEAN NOT NULL DEFAULT FALSE;"
            );
            await context.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Subjects\" ADD COLUMN IF NOT EXISTS \"LessonPosition\" INTEGER NOT NULL DEFAULT 1;"
            );
            await context.Database.ExecuteSqlRawAsync(
                "UPDATE \"Users\" SET \"IsAdmin\" = TRUE WHERE \"Username\" = 'test1' OR \"Email\" = 'test1@kotoba.app' OR \"Id\" = 1;"
            );

            // Clean up any duplicate subjects safely using EF Core change tracking
            var duplicateSubjectGroups = await context.Subjects
                .GroupBy(s => new { s.Character, s.Type })
                .Where(g => g.Count() > 1)
                .Select(g => new { g.Key.Character, g.Key.Type })
                .ToListAsync();

            if (duplicateSubjectGroups.Count > 0)
            {
                foreach (var grp in duplicateSubjectGroups)
                {
                    var subjectsInGroup = await context.Subjects
                        .Where(s => s.Character == grp.Character && s.Type == grp.Type)
                        .OrderBy(s => s.Id)
                        .ToListAsync();

                    var canonical = subjectsInGroup.First();
                    var dups = subjectsInGroup.Skip(1).ToList();
                    var dupIds = dups.Select(d => d.Id).ToList();

                    // Remove foreign key dependencies involving duplicate IDs
                    var depsToRemove = await context.SubjectDependencies
                        .Where(sd => dupIds.Contains(sd.ParentSubjectId) || dupIds.Contains(sd.ChildSubjectId))
                        .ToListAsync();
                    context.SubjectDependencies.RemoveRange(depsToRemove);

                    // Remove SrsItems pointing to duplicate IDs
                    var srsToRemove = await context.SrsItems
                        .Where(si => dupIds.Contains(si.SubjectId))
                        .ToListAsync();
                    context.SrsItems.RemoveRange(srsToRemove);

                    // Remove Reviews pointing to duplicate IDs
                    var reviewsToRemove = await context.Reviews
                        .Where(r => dupIds.Contains(r.SubjectId))
                        .ToListAsync();
                    context.Reviews.RemoveRange(reviewsToRemove);

                    // Remove duplicate subjects
                    context.Subjects.RemoveRange(dups);
                }

                await context.SaveChangesAsync();
            }

            // Create unique index permanently at PostgreSQL database level
            await context.Database.ExecuteSqlRawAsync(
                "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Subjects_Character_Type\" ON \"Subjects\" (\"Character\", \"Type\");"
            );
        }
        catch { }

        // 3. Ensure Level tiers (1 to 60) exist without any hardcoded cards
        if (!await context.Levels.AnyAsync())
        {
            var levels = new List<Level>();
            for (int i = 1; i <= 60; i++)
            {
                levels.Add(new Level
                {
                    LevelNumber = i,
                    Title = i switch
                    {
                        1 => "Genesis: The Building Blocks",
                        2 => "Elements & Basic Actions",
                        3 => "Nature & Everyday Living",
                        _ => $"Curriculum Stage {i}"
                    },
                    Description = $"Level {i} Japanese curriculum: Radicals, Kanji, and Vocabulary.",
                    IsPublished = true
                });
            }
            context.Levels.AddRange(levels);
            await context.SaveChangesAsync();
        }
    }
}
