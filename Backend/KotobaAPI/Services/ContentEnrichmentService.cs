using System.Text;
using System.Text.Json;
using Kotoba.DataAccess.Entities;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;
using Microsoft.Extensions.Configuration;

namespace KotobaAPI.Services;

public class ContentEnrichmentService : IContentEnrichmentService
{
    private static readonly string[] CandidateModels = new[]
    {
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash"
    };

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ISystemLogService? _logService;

    public ContentEnrichmentService(
        HttpClient httpClient,
        IConfiguration config,
        ISystemLogService? logService = null)
    {
        _httpClient = httpClient;
        _config = config;
        _logService = logService;
    }

    public async Task<EnrichedCurriculum> EnrichSubjectsAsync(int level, IReadOnlyList<Subject> subjects)
    {
        if (subjects == null || subjects.Count == 0)
        {
            return new EnrichedCurriculum(level, new List<EnrichedSubjectContentDto>());
        }

        string prompt = BuildEnrichmentPrompt(level, subjects);
        var (success, json, error, usedModel) = await CallGeminiAsync(prompt);

        if (!success)
        {
            _logService?.LogWarning("AI_ENRICH", $"Content enrichment Gemini call failed: {error}. Falling back to clean default mnemonics.");
            return GenerateFallbackEnrichment(level, subjects);
        }

        try
        {
            var enriched = ParseEnrichmentJson(json, level);
            _logService?.LogInfo("AI_ENRICH", $"Successfully enriched {enriched.Enrichments.Count} subjects for Level {level} using {usedModel}");
            return enriched;
        }
        catch (Exception ex)
        {
            _logService?.LogWarning("AI_ENRICH", $"Failed to parse enrichment JSON: {ex.Message}. Falling back to default enrichments.");
            return GenerateFallbackEnrichment(level, subjects);
        }
    }

    private string BuildEnrichmentPrompt(int level, IReadOnlyList<Subject> subjects)
    {
        var compactSubjectList = subjects.Select(s => new
        {
            character = s.Character,
            type = s.Type.ToString(),
            meanings = s.Meanings.Select(m => m.MeaningText).ToList(),
            readings = s.Readings.Select(r => new { reading = r.ReadingText, type = r.Type.ToString() }).ToList(),
            components = s.ParentDependencies.Select(d => d.ParentSubject?.Character).Where(c => c != null).ToList()
        }).ToList();

        var sb = new StringBuilder();
        sb.AppendLine("You are an expert Japanese educator creating original educational mnemonics and contextual examples for Kotoba.");
        sb.AppendLine("Your task is STAGE 2: CONTENT ENRICHMENT for validated curriculum subjects.");
        sb.AppendLine();
        sb.AppendLine($"LEVEL: {level}");
        sb.AppendLine();
        sb.AppendLine("=== APPROVED SUBJECTS TO ENRICH ===");
        sb.AppendLine(JsonSerializer.Serialize(compactSubjectList, new JsonSerializerOptions { WriteIndented = true }));
        sb.AppendLine();
        sb.AppendLine("=== STRICT CONTENT GUIDELINES ===");
        sb.AppendLine("1. ORIGINAL MNEMONICS: Write vivid, imaginative, humorous, or emotional mental association stories linking visual components to the meaning, and pronunciation recall stories for readings.");
        sb.AppendLine("2. NO WANIKANI COPYING: NEVER copy WaniKani mnemonics, explanations, proprietary naming, or example sentences. All content must be 100% original to Kotoba.");
        sb.AppendLine("3. VOCABULARY SENTENCES: For Vocabulary, write natural, native-sounding Japanese sentences with accurate English translations and optional furigana markup (e.g., '私[わたし]は本[ほん]を読[よ]みます。').");
        sb.AppendLine("4. Radicals require Meaning Mnemonics and Meaning Hints. Kanji require Meaning & Reading Mnemonics and Hints. Vocabulary requires Meaning & Reading Mnemonics and Example Sentences.");
        sb.AppendLine();
        sb.AppendLine("=== OUTPUT JSON SCHEMA ===");
        sb.AppendLine("Return strictly a valid JSON object matching this exact schema:");
        sb.AppendLine(@"{
  ""level"": " + level + @",
  ""enrichments"": [
    {
      ""character"": ""..."",
      ""type"": ""Radical"",
      ""meaningHint"": ""A clear visual hint about the symbol."",
      ""readingHint"": null,
      ""meaningMnemonic"": ""Original memorable story explaining the meaning."",
      ""readingMnemonic"": null,
      ""exampleSentences"": []
    },
    {
      ""character"": ""..."",
      ""type"": ""Kanji"",
      ""meaningHint"": ""Concept hint."",
      ""readingHint"": ""Pronunciation tip."",
      ""meaningMnemonic"": ""Story combining its component radicals into the kanji meaning."",
      ""readingMnemonic"": ""Story connecting the kanji to its pronunciation."",
      ""exampleSentences"": []
    },
    {
      ""character"": ""..."",
      ""type"": ""Vocabulary"",
      ""meaningHint"": ""Everyday usage hint."",
      ""readingHint"": ""Reading recall tip."",
      ""meaningMnemonic"": ""Story linking the kanji to this word meaning."",
      ""readingMnemonic"": ""Reading phonetic trigger story."",
      ""exampleSentences"": [
        {
          ""japanese"": ""木[き]の下[した]で休[やす]む。"",
          ""english"": ""Rest under the tree."",
          ""furigana"": ""木[き]の下[した]で休[やす]む。""
        }
      ]
    }
  ]
}");
        return sb.ToString();
    }

    private async Task<(bool Success, string Json, string? Error, string UsedModel)> CallGeminiAsync(string prompt)
    {
        var apiKey = _config["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return (false, "{}", "GEMINI_API_KEY not configured.", "None");
        }

        string preferredModel = _config["Gemini:Model"] ?? Environment.GetEnvironmentVariable("GEMINI_MODEL") ?? "gemini-2.5-flash";
        var modelsToTry = new List<string> { preferredModel };
        foreach (var m in CandidateModels)
        {
            if (!modelsToTry.Contains(m)) modelsToTry.Add(m);
        }

        string lastError = "";
        string lastModel = preferredModel;

        foreach (var model in modelsToTry)
        {
            try
            {
                lastModel = model;
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
                var payload = new
                {
                    contents = new[]
                    {
                        new { parts = new[] { new { text = prompt } } }
                    },
                    generationConfig = new
                    {
                        responseMimeType = "application/json",
                        maxOutputTokens = 65536
                    }
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                var raw = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    lastError = $"HTTP {response.StatusCode}: {raw}";

                    if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                    {
                        var (isDailyQuota, retrySeconds) = AnalyzeRateLimit(raw);
                        _logService?.LogWarning("AI_ENRICH", $"Model {model} rate limited (HTTP 429). DailyQuota={isDailyQuota}, RetryDelay={retrySeconds}s");

                        if (!isDailyQuota && retrySeconds > 0 && retrySeconds <= 35)
                        {
                            _logService?.LogInfo("AI_ENRICH", $"Waiting {retrySeconds}s cooldown for {model} RPM reset...");
                            await Task.Delay(TimeSpan.FromSeconds(retrySeconds + 1));

                            var retryResponse = await _httpClient.PostAsync(url, content);
                            var retryRaw = await retryResponse.Content.ReadAsStringAsync();
                            if (retryResponse.IsSuccessStatusCode)
                            {
                                string text = ExtractJsonFromGeminiResponse(retryRaw);
                                return (true, text, null, model);
                            }
                            lastError = $"HTTP {retryResponse.StatusCode}: {retryRaw}";
                        }
                    }

                    continue; // Try next candidate model with separate quota
                }

                string jsonText = ExtractJsonFromGeminiResponse(raw);
                return (true, jsonText, null, model);
            }
            catch (Exception ex)
            {
                lastError = ex.Message;
            }
        }

        if (lastError.Contains("429") || lastError.Contains("RESOURCE_EXHAUSTED"))
        {
            lastError = "Gemini API Quota Exceeded (HTTP 429). Google AI Studio Free Tier quota limit reached. " +
                        "To remove free tier request limits and unlock 1,000+ RPM, upgrade your project to Tier 1 (Pay-as-you-go) at https://ai.google.dev/gemini-api/docs/rate-limits#tier-1 by linking a billing account. " +
                        "Details: " + lastError;
        }

        return (false, "{}", lastError, lastModel);
    }

    private (bool IsDailyQuota, double RetrySeconds) AnalyzeRateLimit(string rawJson)
    {
        bool isDaily = false;
        double retrySec = 0;

        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            if (doc.RootElement.TryGetProperty("error", out var errObj))
            {
                var msg = errObj.TryGetProperty("message", out var m) ? m.GetString() ?? "" : "";
                if (msg.Contains("PerDay", StringComparison.OrdinalIgnoreCase) ||
                    msg.Contains("free_tier_requests", StringComparison.OrdinalIgnoreCase))
                {
                    isDaily = true;
                }

                if (errObj.TryGetProperty("details", out var details) && details.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in details.EnumerateArray())
                    {
                        if (item.TryGetProperty("quotaId", out var qId) &&
                            qId.GetString()?.Contains("PerDay", StringComparison.OrdinalIgnoreCase) == true)
                        {
                            isDaily = true;
                        }

                        if (item.TryGetProperty("retryDelay", out var rDelay))
                        {
                            var delayStr = rDelay.GetString()?.TrimEnd('s');
                            if (double.TryParse(delayStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var sec))
                            {
                                retrySec = sec;
                            }
                        }
                    }
                }

                if (retrySec <= 0)
                {
                    var match = System.Text.RegularExpressions.Regex.Match(msg, @"retry in ([0-9.]+)s", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (match.Success && double.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var sec))
                    {
                        retrySec = sec;
                    }
                }
            }
        }
        catch {}

        return (isDaily, retrySec);
    }

    private string ExtractJsonFromGeminiResponse(string rawResponse)
    {
        try
        {
            using var doc = JsonDocument.Parse(rawResponse);
            if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
                candidates.GetArrayLength() > 0)
            {
                var candidate = candidates[0];
                if (candidate.TryGetProperty("content", out var content) &&
                    content.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0)
                {
                    var text = parts[0].TryGetProperty("text", out var t) ? t.GetString() ?? "" : "";
                    text = text.Trim();
                    if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                    {
                        text = text.Substring(7);
                    }
                    else if (text.StartsWith("```"))
                    {
                        text = text.Substring(3);
                    }
                    if (text.EndsWith("```"))
                    {
                        text = text.Substring(0, text.Length - 3);
                    }
                    return text.Trim();
                }
            }
        }
        catch
        {
            // fallback
        }
        return rawResponse;
    }

    private EnrichedCurriculum ParseEnrichmentJson(string json, int defaultLevel)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        int level = root.TryGetProperty("level", out var l) ? l.GetInt32() : defaultLevel;
        var enrichments = new List<EnrichedSubjectContentDto>();

        if (root.TryGetProperty("enrichments", out var enArray) && enArray.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in enArray.EnumerateArray())
            {
                var character = el.TryGetProperty("character", out var ch) ? ch.GetString() ?? "" : "";
                var typeStr = el.TryGetProperty("type", out var tp) ? tp.GetString() ?? "Kanji" : "Kanji";
                var sType = Enum.TryParse<SubjectType>(typeStr, true, out var st) ? st : SubjectType.Kanji;
                var meaningHint = el.TryGetProperty("meaningHint", out var mh) ? mh.GetString() : null;
                var readingHint = el.TryGetProperty("readingHint", out var rh) ? rh.GetString() : null;
                var meaningMnemonic = el.TryGetProperty("meaningMnemonic", out var mm) ? mm.GetString() : null;
                var readingMnemonic = el.TryGetProperty("readingMnemonic", out var rm) ? rm.GetString() : null;

                var sentences = new List<EnrichedSentenceDto>();
                if (el.TryGetProperty("exampleSentences", out var sentEl) && sentEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var s in sentEl.EnumerateArray())
                    {
                        var jp = s.TryGetProperty("japanese", out var j) ? j.GetString() ?? "" : "";
                        var en = s.TryGetProperty("english", out var e) ? e.GetString() ?? "" : "";
                        var fg = s.TryGetProperty("furigana", out var f) ? f.GetString() : null;
                        if (!string.IsNullOrWhiteSpace(jp))
                        {
                            sentences.Add(new EnrichedSentenceDto(jp.Trim(), en.Trim(), fg?.Trim()));
                        }
                    }
                }

                if (!string.IsNullOrWhiteSpace(character))
                {
                    enrichments.Add(new EnrichedSubjectContentDto(
                        Character: character.Trim(),
                        Type: sType,
                        MeaningHint: meaningHint?.Trim(),
                        ReadingHint: readingHint?.Trim(),
                        MeaningMnemonic: meaningMnemonic?.Trim(),
                        ReadingMnemonic: readingMnemonic?.Trim(),
                        ExampleSentences: sentences
                    ));
                }
            }
        }

        return new EnrichedCurriculum(level, enrichments);
    }

    private EnrichedCurriculum GenerateFallbackEnrichment(int level, IReadOnlyList<Subject> subjects)
    {
        var enrichments = new List<EnrichedSubjectContentDto>();
        foreach (var s in subjects)
        {
            var primaryMeaning = s.Meanings.FirstOrDefault(m => m.IsPrimary)?.MeaningText ?? s.Meanings.FirstOrDefault()?.MeaningText ?? "meaning";
            var primaryReading = s.Readings.FirstOrDefault(r => r.IsPrimary)?.ReadingText ?? s.Readings.FirstOrDefault()?.ReadingText ?? "";

            var sentences = new List<EnrichedSentenceDto>();
            if (s.Type == SubjectType.Vocabulary)
            {
                sentences.Add(new EnrichedSentenceDto(
                    Japanese: $"{s.Character}です。",
                    English: $"It is {primaryMeaning.ToLowerInvariant()}.",
                    Furigana: null
                ));
            }

            enrichments.Add(new EnrichedSubjectContentDto(
                Character: s.Character,
                Type: s.Type,
                MeaningHint: $"Visual representation of {primaryMeaning}.",
                ReadingHint: !string.IsNullOrWhiteSpace(primaryReading) ? $"Remember phonetic: {primaryReading}" : null,
                MeaningMnemonic: $"Remember the visual shape of '{s.Character}' directly representing {primaryMeaning.ToLowerInvariant()}.",
                ReadingMnemonic: !string.IsNullOrWhiteSpace(primaryReading) ? $"The character '{s.Character}' is pronounced as {primaryReading}." : null,
                ExampleSentences: sentences
            ));
        }
        return new EnrichedCurriculum(level, enrichments);
    }
}
