using System.Collections.Concurrent;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class SystemLogService : ISystemLogService
{
    private const int MaxEntries = 500;
    private readonly ConcurrentQueue<SystemLogEntry> _logs = new();

    public void Log(SystemLogEntry entry)
    {
        _logs.Enqueue(entry);
        while (_logs.Count > MaxEntries && _logs.TryDequeue(out _))
        {
        }
    }

    public void LogInfo(string category, string message, string? endpoint = null, string? method = null, int? statusCode = null, long durationMs = 0, string? user = null, string? details = null)
    {
        Log(new SystemLogEntry(
            Id: Guid.NewGuid().ToString("N")[..8],
            Timestamp: DateTime.UtcNow,
            Level: "INFO",
            Category: category,
            Method: method ?? "APP",
            Endpoint: endpoint ?? "-",
            StatusCode: statusCode,
            DurationMs: durationMs,
            Message: message,
            User: user,
            Details: details
        ));
    }

    public void LogWarning(string category, string message, string? endpoint = null, string? method = null, int? statusCode = null, long durationMs = 0, string? user = null, string? details = null)
    {
        Log(new SystemLogEntry(
            Id: Guid.NewGuid().ToString("N")[..8],
            Timestamp: DateTime.UtcNow,
            Level: "WARN",
            Category: category,
            Method: method ?? "APP",
            Endpoint: endpoint ?? "-",
            StatusCode: statusCode,
            DurationMs: durationMs,
            Message: message,
            User: user,
            Details: details
        ));
    }

    public void LogError(string category, string message, Exception? ex = null, string? endpoint = null, string? method = null, int? statusCode = null, long durationMs = 0, string? user = null)
    {
        Log(new SystemLogEntry(
            Id: Guid.NewGuid().ToString("N")[..8],
            Timestamp: DateTime.UtcNow,
            Level: "ERROR",
            Category: category,
            Method: method ?? "APP",
            Endpoint: endpoint ?? "-",
            StatusCode: statusCode ?? 500,
            DurationMs: durationMs,
            Message: message,
            User: user,
            Details: ex != null ? $"{ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}" : null
        ));
    }

    public IReadOnlyList<SystemLogEntry> GetRecentLogs(int limit = 100, string? level = null, string? category = null, string? search = null)
    {
        IEnumerable<SystemLogEntry> query = _logs.Reverse();

        if (!string.IsNullOrWhiteSpace(level) && level != "ALL")
        {
            query = query.Where(l => string.Equals(l.Level, level, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(category) && category != "ALL")
        {
            query = query.Where(l => string.Equals(l.Category, category, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(l =>
                l.Message.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                l.Endpoint.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                (l.User != null && l.User.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                (l.Details != null && l.Details.Contains(s, StringComparison.OrdinalIgnoreCase))
            );
        }

        return query.Take(Math.Clamp(limit, 1, MaxEntries)).ToList();
    }

    public void Clear()
    {
        while (_logs.TryDequeue(out _)) { }
    }
}
