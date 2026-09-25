using Kotoba.Utility.Enums;

namespace Kotoba.DataAccess.Entities;

public class Review : BaseEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public int SrsItemId { get; set; }
    public SrsItem SrsItem { get; set; } = null!;

    public ReviewType ReviewType { get; set; }
    public string SubmittedAnswer { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public SrsStage PreviousStage { get; set; }
    public SrsStage NewStage { get; set; }
    public DateTime ReviewedAt { get; set; } = DateTime.UtcNow;
    public int ResponseTimeMs { get; set; }
}
