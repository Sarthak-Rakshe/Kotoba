namespace KotobaAPI.Services.Interfaces;

public record SystemLogEntry(
    string Id,
    DateTime Timestamp,
    string Level,
    string Category,
    string Method,
    string Endpoint,
    int? StatusCode,
    long DurationMs,
    string Message,
    string? User = null,
    string? ClientIp = null,
    string? Details = null
);

public interface ISystemLogService
{
    void Log(SystemLogEntry entry);
    void LogInfo(string category, string message, string? endpoint = null, string? method = null, int? statusCode = null, long durationMs = 0, string? user = null, string? details = null);
    void LogWarning(string category, string message, string? endpoint = null, string? method = null, int? statusCode = null, long durationMs = 0, string? user = null, string? details = null);
    void LogError(string category, string message, Exception? ex = null, string? endpoint = null, string? method = null, int? statusCode = null, long durationMs = 0, string? user = null);
    IReadOnlyList<SystemLogEntry> GetRecentLogs(int limit = 100, string? level = null, string? category = null, string? search = null);
    void Clear();
}
