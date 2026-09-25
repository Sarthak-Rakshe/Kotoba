using Kotoba.Utility.Enums;

namespace Kotoba.DataAccess.Entities;

public class Subject : BaseEntity
{
    public string Character { get; set; } = string.Empty;
    public SubjectType Type { get; set; }
    public int Level { get; set; }
    public int LessonPosition { get; set; } = 1;
    public string? MeaningHint { get; set; }
    public string? ReadingHint { get; set; }

    // Navigation properties
    public ICollection<Meaning> Meanings { get; set; } = new List<Meaning>();
    public ICollection<Reading> Readings { get; set; } = new List<Reading>();
    public ICollection<Mnemonic> Mnemonics { get; set; } = new List<Mnemonic>();
    public ICollection<ExampleSentence> ExampleSentences { get; set; } = new List<ExampleSentence>();

    // Dependencies where this Subject is the child (depends on parents)
    public ICollection<SubjectDependency> ParentDependencies { get; set; } = new List<SubjectDependency>();

    // Dependencies where this Subject is the parent (children depend on this)
    public ICollection<SubjectDependency> ChildDependencies { get; set; } = new List<SubjectDependency>();

    public ICollection<SrsItem> SrsItems { get; set; } = new List<SrsItem>();
}
