using Kotoba.Utility.Enums;

namespace Kotoba.DataAccess.Entities;

public class SrsItem : BaseEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public SrsStage Stage { get; set; } = SrsStage.Initiate;
    public DateTime? AvailableAt { get; set; }
    public DateTime? LastReviewedAt { get; set; }
    public DateTime? UnlockedAt { get; set; }
    public DateTime? PassedAt { get; set; }
    public DateTime? BurnedAt { get; set; }

    public int ReviewCount { get; set; }
    public int CorrectCount { get; set; }
    public int IncorrectCount { get; set; }
    public int ConsecutiveCorrect { get; set; }
    public int ConsecutiveIncorrect { get; set; }

    public SrsStage? MeaningStage { get; set; }
    public SrsStage? ReadingStage { get; set; }
}
