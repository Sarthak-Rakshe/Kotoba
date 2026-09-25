namespace Kotoba.DataAccess.Entities;

public class ExampleSentence : BaseEntity
{
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public string Japanese { get; set; } = string.Empty;
    public string English { get; set; } = string.Empty;
    public string? Furigana { get; set; }
}
