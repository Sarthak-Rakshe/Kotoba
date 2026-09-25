using Kotoba.Utility.Enums;

namespace Kotoba.DataAccess.Entities;

public class Reading : BaseEntity
{
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public string ReadingText { get; set; } = string.Empty;
    public ReadingType Type { get; set; } = ReadingType.Onyomi;
    public bool IsPrimary { get; set; } = true;
    public string? AcceptedAlternatives { get; set; }
}
