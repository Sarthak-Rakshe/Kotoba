using Kotoba.Utility.Enums;

namespace Kotoba.DataAccess.Entities;

public class SubjectDependency : BaseEntity
{
    public int ParentSubjectId { get; set; }
    public Subject ParentSubject { get; set; } = null!;

    public int ChildSubjectId { get; set; }
    public Subject ChildSubject { get; set; } = null!;

    public DependencyType DependencyType { get; set; } = DependencyType.Component;
}
