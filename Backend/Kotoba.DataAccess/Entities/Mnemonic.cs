using Kotoba.Utility.Enums;

namespace Kotoba.DataAccess.Entities;

public class Mnemonic : BaseEntity
{
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public ReviewType Type { get; set; } = ReviewType.Meaning;
    public string Text { get; set; } = string.Empty;
    public string? Hint { get; set; }
}
