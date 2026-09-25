using System.Text;

namespace Kotoba.Utility.Helpers;

public static class JapaneseTextHelper
{
    public static bool IsHiragana(char c) => c >= 0x3040 && c <= 0x309F;
    public static bool IsKatakana(char c) => c >= 0x30A0 && c <= 0x30FF;
    public static bool IsKanji(char c) => (c >= 0x4E00 && c <= 0x9FAF) || (c >= 0x3400 && c <= 0x4DBF);

    public static bool ContainsJapanese(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        foreach (var c in text)
        {
            if (IsHiragana(c) || IsKatakana(c) || IsKanji(c)) return true;
        }
        return false;
    }

    /// <summary>
    /// Converts Katakana characters in text to Hiragana.
    /// </summary>
    public static string KatakanaToHiragana(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var sb = new StringBuilder(text.Length);
        foreach (var c in text)
        {
            if (c >= 0x30A1 && c <= 0x30F6)
            {
                sb.Append((char)(c - 0x60));
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }

    /// <summary>
    /// Normalizes Japanese text: trims, converts Katakana to Hiragana, converts full-width spaces to half-width.
    /// </summary>
    public static string NormalizeReading(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var normalized = input.Trim().Replace("　", " ");
        normalized = KatakanaToHiragana(normalized);
        return normalized;
    }
}
