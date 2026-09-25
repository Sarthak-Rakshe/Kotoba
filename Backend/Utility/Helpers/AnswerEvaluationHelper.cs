using System.Text.RegularExpressions;

namespace Kotoba.Utility.Helpers;

public record EvaluationResult(bool IsCorrect, bool HasTypoWarning, string NormalizedAnswer);

public static class AnswerEvaluationHelper
{
    private static readonly Regex PunctuationRegex = new(@"[^\w\s]", RegexOptions.Compiled);

    public static string NormalizeMeaning(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var lowered = text.Trim().ToLowerInvariant();
        lowered = PunctuationRegex.Replace(lowered, " ");
        lowered = Regex.Replace(lowered, @"\s+", " ").Trim();
        if (lowered.StartsWith("to "))
        {
            lowered = lowered[3..].Trim();
        }
        return lowered;
    }

    public static int ComputeLevenshteinDistance(string s, string t)
    {
        if (string.IsNullOrEmpty(s)) return string.IsNullOrEmpty(t) ? 0 : t.Length;
        if (string.IsNullOrEmpty(t)) return s.Length;

        int n = s.Length;
        int m = t.Length;
        int[,] d = new int[n + 1, m + 1];

        for (int i = 0; i <= n; d[i, 0] = i++) { }
        for (int j = 0; j <= m; d[0, j] = j++) { }

        for (int i = 1; i <= n; i++)
        {
            for (int j = 1; j <= m; j++)
            {
                int cost = (t[j - 1] == s[i - 1]) ? 0 : 1;
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + cost);
            }
        }

        return d[n, m];
    }

    public static EvaluationResult EvaluateMeaning(string submittedAnswer, IEnumerable<string> acceptedMeanings)
    {
        var normUser = NormalizeMeaning(submittedAnswer);
        if (string.IsNullOrEmpty(normUser))
        {
            return new EvaluationResult(false, false, string.Empty);
        }

        bool closeMatch = false;

        foreach (var accepted in acceptedMeanings)
        {
            var normAccepted = NormalizeMeaning(accepted);
            if (normUser.Equals(normAccepted, StringComparison.OrdinalIgnoreCase))
            {
                return new EvaluationResult(true, false, normUser);
            }

            // Check typo tolerance: allows 1 typo if length >= 4
            if (normAccepted.Length >= 4 && Math.Abs(normUser.Length - normAccepted.Length) <= 1)
            {
                var distance = ComputeLevenshteinDistance(normUser, normAccepted);
                if (distance == 1)
                {
                    closeMatch = true;
                }
            }
        }

        if (closeMatch)
        {
            return new EvaluationResult(true, true, normUser);
        }

        return new EvaluationResult(false, false, normUser);
    }

    public static EvaluationResult EvaluateReading(string submittedAnswer, IEnumerable<string> acceptedReadings)
    {
        var normUser = JapaneseTextHelper.NormalizeReading(submittedAnswer);
        if (string.IsNullOrEmpty(normUser))
        {
            return new EvaluationResult(false, false, string.Empty);
        }

        foreach (var accepted in acceptedReadings)
        {
            var normAccepted = JapaneseTextHelper.NormalizeReading(accepted);
            if (normUser.Equals(normAccepted, StringComparison.OrdinalIgnoreCase))
            {
                return new EvaluationResult(true, false, normUser);
            }
        }

        return new EvaluationResult(false, false, normUser);
    }
}
