namespace Kotoba.DataAccess.Entities;

public class User : BaseEntity
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public int CurrentLevel { get; set; } = 1;
    public bool IsAdmin { get; set; } = false;

    public ICollection<SrsItem> SrsItems { get; set; } = new List<SrsItem>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
}
