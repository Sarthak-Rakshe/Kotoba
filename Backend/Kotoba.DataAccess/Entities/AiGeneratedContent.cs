using Kotoba.Utility.Enums;

namespace Kotoba.DataAccess.Entities;

public class AiGeneratedContent : BaseEntity
{
    public SubjectType SubjectType { get; set; }
    public string TargetCharacter { get; set; } = string.Empty;
    public string RawResponse { get; set; } = string.Empty;
    public string ParsedContentJson { get; set; } = string.Empty;
    public string Provider { get; set; } = "Gemini";
    public string Model { get; set; } = "gemini-2.5-flash";
    public AiContentStatus Status { get; set; } = AiContentStatus.Pending;
    public string? ValidationErrors { get; set; }
    public DateTime? ApprovedAt { get; set; }
}
