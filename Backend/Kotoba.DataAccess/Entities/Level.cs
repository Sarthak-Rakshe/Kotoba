namespace Kotoba.DataAccess.Entities;

public class Level : BaseEntity
{
    public int LevelNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublished { get; set; } = true;
}
