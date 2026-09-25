namespace Kotoba.DataAccess.Entities;

public class Meaning : BaseEntity
{
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public string MeaningText { get; set; } = string.Empty;
    public bool IsPrimary { get; set; } = true;
    public string? AcceptedAlternatives { get; set; }
}
