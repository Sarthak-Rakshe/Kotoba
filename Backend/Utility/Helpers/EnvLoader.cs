namespace Kotoba.Utility.Helpers;

public static class EnvLoader
{
    public static void Load(string? searchDirectory = null)
    {
        var dir = searchDirectory ?? Directory.GetCurrentDirectory();
        
        // Search current directory and up to 3 parent directories for .env
        string? envPath = null;
        var current = new DirectoryInfo(dir);
        for (int i = 0; i < 4 && current != null; i++)
        {
            var candidate = Path.Combine(current.FullName, ".env");
            if (File.Exists(candidate))
            {
                envPath = candidate;
                break;
            }
            current = current.Parent;
        }

        if (string.IsNullOrEmpty(envPath) || !File.Exists(envPath))
        {
            return;
        }

        foreach (var line in File.ReadAllLines(envPath))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith('#'))
                continue;

            var equalsIdx = trimmed.IndexOf('=');
            if (equalsIdx <= 0) continue;

            var key = trimmed[..equalsIdx].Trim();
            var val = trimmed[(equalsIdx + 1)..].Trim();

            // Unquote if wrapped in quotes
            if (val.Length >= 2 && ((val.StartsWith('"') && val.EndsWith('"')) || (val.StartsWith('\'') && val.EndsWith('\''))))
            {
                val = val[1..^1];
            }

            // Set environment variable only if not already present in OS environment
            if (Environment.GetEnvironmentVariable(key) == null)
            {
                Environment.SetEnvironmentVariable(key, val);
            }
        }
    }
}
