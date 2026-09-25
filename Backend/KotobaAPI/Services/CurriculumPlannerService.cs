using System.Text;
using System.Text.Json;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;
using Microsoft.Extensions.Configuration;

namespace KotobaAPI.Services;

public class CurriculumPlannerService : ICurriculumPlannerService
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

    public CurriculumPlannerService(
        HttpClient httpClient,
        IConfiguration config,
        ISystemLogService? logService = null)
    {
        _httpClient = httpClient;
        _config = config;
        _logService = logService;
    }

    public async Task<ProposedCurriculum> GenerateLevelPlanAsync(
        int level,
        CurriculumContext context,
        LevelRequirements requirements)
    {
        string prompt = BuildPlannerPrompt(level, context, requirements);
        var (success, json, error, usedModel) = await CallGeminiAsync(prompt, enableSearchGrounding: false);

        if (!success)
        {
            _logService?.LogWarning("AI_PLANNER", $"Gemini curriculum planning failed: {error}.");
            throw new InvalidOperationException($"Curriculum planning failed across models: {error}");
        }

        _logService?.LogInfo("AI_PLANNER", $"Curriculum plan generated for Level {level} using {usedModel}");
        return ParsePlanJson(json, level);
    }

    public async Task<List<ProposedSubjectDto>> RegenerateInvalidSubjectsAsync(
        int level,
        CurriculumContext context,
        List<ProposedSubjectDto> invalidSubjects,
        List<string> errors)
    {
        if (invalidSubjects == null || invalidSubjects.Count == 0)
        {
            return new List<ProposedSubjectDto>();
        }

        string prompt = BuildPartialRegenerationPrompt(level, context, invalidSubjects, errors);
        var (success, json, error, usedModel) = await CallGeminiAsync(prompt, enableSearchGrounding: false);

        if (!success)
        {
            _logService?.LogWarning("AI_PLANNER", $"Partial subject regeneration failed: {error}");
            return new List<ProposedSubjectDto>();
        }

        var partialCurriculum = ParsePlanJson(json, level);
        return partialCurriculum.Subjects;
    }

    private string BuildPlannerPrompt(int level, CurriculumContext context, LevelRequirements requirements)
    {
        string stageGuidance = level switch
        {
            <= 10 => "Stage 1 (Levels 1–10): Foundational Radicals, highly common single Kanji (numbers, basic elements, fundamental verbs), and simple 1-2 kanji vocabulary.",
            <= 20 => "Stage 2 (Levels 11–20): Core everyday Japanese, high-frequency school/society/home Kanji, and compound words (Jukugo).",
            <= 30 => "Stage 3 (Levels 21–30): Intermediate Kanji, expressive adverbs/adjectives, business/nature compound vocabulary.",
            <= 40 => "Stage 4 (Levels 31–40): Intermediate to Upper-Intermediate Kanji, nuanced vocabulary, abstract concepts.",
            <= 50 => "Stage 5 (Levels 41–50): Advanced everyday and formal Kanji, specialized compounds, formal written Japanese.",
            _ => "Stage 6 (Levels 51–60): Rare/literary Joyo Kanji, advanced idioms, classical compounds, professional vocabulary."
        };

        var sb = new StringBuilder();
        sb.AppendLine("You are an expert Japanese curriculum planner and pedagogue designing a cumulative, progressive Japanese learning deck for Kotoba.");
        sb.AppendLine("Your task is STAGE 1: CURRICULUM PLANNING. You will plan the structural subjects for a single level.");
        sb.AppendLine();
        sb.AppendLine($"CURRENT LEVEL: {level}");
        sb.AppendLine($"REQUIRED COUNTS: {requirements.RadicalCount} Radicals, {requirements.KanjiCount} Kanji, {requirements.VocabCount} Vocabulary (Total: {requirements.RadicalCount + requirements.KanjiCount + requirements.VocabCount} subjects)");
        if (!string.IsNullOrWhiteSpace(requirements.Theme))
        {
            sb.AppendLine($"THEMATIC EMPHASIS (Optional guideline): {requirements.Theme}");
        }
        sb.AppendLine($"LEVEL DIFFICULTY GUIDANCE: {stageGuidance}");
        sb.AppendLine();
        sb.AppendLine("=== CURRICULUM CONTEXT (DATABASE TRUTH) ===");
        sb.AppendLine($"Known Components ({context.KnownComponents.Count}): {JsonSerializer.Serialize(context.KnownComponents)}");
        sb.AppendLine($"Known Kanji ({context.KnownKanji.Count}): {JsonSerializer.Serialize(context.KnownKanji)}");
        sb.AppendLine($"Known Vocabulary ({context.KnownVocabulary.Count}): {JsonSerializer.Serialize(context.KnownVocabulary)}");
        sb.AppendLine($"Known Readings Sample ({Math.Min(context.KnownReadings.Count, 60)}): {JsonSerializer.Serialize(context.KnownReadings.Take(60))}");
        if (context.RecentKanji.Count > 0)
        {
            sb.AppendLine($"Recent Kanji to Strongly Reinforce ({context.RecentKanji.Count}): {JsonSerializer.Serialize(context.RecentKanji)}");
        }
        sb.AppendLine();
        sb.AppendLine("=== CRITICAL PEDAGOGICAL RULES ===");
        sb.AppendLine("1. IMMUTABLE HISTORY: Known components, Kanji, and vocabulary are already learned. DO NOT GENERATE ANY SUBJECT WHOSE CHARACTER ALREADY EXISTS IN THE KNOWN CURRICULUM.");
        sb.AppendLine("2. COMPONENT DECOMPOSITION: Kanji must preferably decompose into known components, or new components introduced in this exact level.");
        sb.AppendLine("3. VOCABULARY REINFORCEMENT: Vocabulary words MUST use either the new Kanji introduced in this level or the recent Kanji listed above.");
        sb.AppendLine("4. DETERMINISTIC LESSON ORDERING:");
        sb.AppendLine($"   - Lesson positions 1 to {requirements.RadicalCount}: Radicals (visual building blocks)");
        sb.AppendLine($"   - Lesson positions {requirements.RadicalCount + 1} to {requirements.RadicalCount + requirements.KanjiCount}: Kanji using those building blocks");
        sb.AppendLine($"   - Lesson positions {requirements.RadicalCount + requirements.KanjiCount + 1} to {requirements.RadicalCount + requirements.KanjiCount + requirements.VocabCount}: Vocabulary reinforcing those Kanji");
        sb.AppendLine("   - A prerequisite subject must strictly have a lower lessonPosition than any subject that depends on it.");
        sb.AppendLine("5. RELIABLE PUBLIC JAPANESE REFERENCE:");
        sb.AppendLine("   - Kanji must be genuine Joyo / Jinmeiyo CJK characters with accurate standard Onyomi and/or Kunyomi.");
        sb.AppendLine("   - Readings must be in Kana (Hiragana for Kunyomi/Vocab, Katakana or Hiragana for Onyomi).");
        sb.AppendLine("   - Vocabulary must be genuine, commonly recognized Japanese words.");
        sb.AppendLine("6. NO PROPRIETARY COPYING: Do NOT copy WaniKani's mnemonics, hints, or proprietary naming. Keep this response purely structural.");
        sb.AppendLine("7. NO DESCRIPTION/MNEMONICS AT THIS STAGE: Do not generate mnemonics or long sentences now. Stage 2 will handle content enrichment.");
        sb.AppendLine();
        sb.AppendLine("=== OUTPUT JSON SCHEMA ===");
        sb.AppendLine("Return strictly a valid JSON object matching this exact format:");
        sb.AppendLine(@"{
  ""level"": " + level + @",
  ""subjects"": [
    {
      ""type"": ""Radical"",
      ""character"": ""一"",
      ""level"": " + level + @",
      ""lessonPosition"": 1,
      ""componentCharacters"": [],
      ""meanings"": [
        { ""meaning"": ""Ground"", ""isPrimary"": true, ""alternatives"": ""One, Line"" }
      ],
      ""readings"": []
    },
    {
      ""type"": ""Kanji"",
      ""character"": ""木"",
      ""level"": " + level + @",
      ""lessonPosition"": 2,
      ""componentCharacters"": [""一"", ""十""],
      ""meanings"": [
        { ""meaning"": ""Tree"", ""isPrimary"": true, ""alternatives"": ""Wood"" }
      ],
      ""readings"": [
        { ""reading"": ""もく"", ""type"": ""Onyomi"", ""isPrimary"": true, ""alternatives"": ""ぼく"" },
        { ""reading"": ""き"", ""type"": ""Kunyomi"", ""isPrimary"": false, ""alternatives"": ""こ"" }
      ]
    },
    {
      ""type"": ""Vocabulary"",
      ""character"": ""木"",
      ""level"": " + level + @",
      ""lessonPosition"": 3,
      ""componentCharacters"": [""木""],
      ""meanings"": [
        { ""meaning"": ""Tree"", ""isPrimary"": true, ""alternatives"": ""Wood"" }
      ],
      ""readings"": [
        { ""reading"": ""き"", ""type"": ""VocabularyReading"", ""isPrimary"": true, ""alternatives"": """" }
      ]
    }
  ]
}");
        return sb.ToString();
    }

    private string BuildPartialRegenerationPrompt(
        int level,
        CurriculumContext context,
        List<ProposedSubjectDto> invalidSubjects,
        List<string> errors)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are an expert Japanese curriculum planner fixing validation defects in a curriculum proposal for Kotoba.");
        sb.AppendLine($"LEVEL: {level}");
        sb.AppendLine();
        sb.AppendLine("=== VALIDATION DEFECTS TO REMEDY ===");
        foreach (var err in errors.Take(15))
        {
            sb.AppendLine($"- {err}");
        }
        sb.AppendLine();
        sb.AppendLine("=== INVALID SUBJECTS TO REPLACE ===");
        sb.AppendLine(JsonSerializer.Serialize(invalidSubjects));
        sb.AppendLine();
        sb.AppendLine("Generate valid replacement subjects of the exact same types and lesson positions as the invalid items.");
        sb.AppendLine("Remember: Do NOT generate characters from known curriculum: " + JsonSerializer.Serialize(context.KnownKanji.Take(30)));
        sb.AppendLine("Return strictly JSON with { \"level\": " + level + ", \"subjects\": [ ... ] }.");
        return sb.ToString();
    }

    private async Task<(bool Success, string Json, string? Error, string UsedModel)> CallGeminiAsync(
        string prompt,
        bool enableSearchGrounding)
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

                object requestBody;
                if (enableSearchGrounding)
                {
                    requestBody = new
                    {
                        contents = new[]
                        {
                            new { parts = new[] { new { text = prompt } } }
                        },
                        generationConfig = new
                        {
                            responseMimeType = "application/json",
                            maxOutputTokens = 65536
                        },
                        tools = new object[]
                        {
                            new { google_search = new { } }
                        }
                    };
                }
                else
                {
                    requestBody = new
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
                }

                var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                var raw = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    lastError = $"HTTP {response.StatusCode}: {raw}";

                    if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                    {
                        var (isDailyQuota, retrySeconds) = AnalyzeRateLimit(raw);
                        _logService?.LogWarning("AI_PLANNER", $"Model {model} rate limited (HTTP 429). DailyQuota={isDailyQuota}, RetryDelay={retrySeconds}s");

                        // If it's a short RPM throttle (<= 35s) and NOT a daily quota exhaustion, wait and retry once
                        if (!isDailyQuota && retrySeconds > 0 && retrySeconds <= 35)
                        {
                            _logService?.LogInfo("AI_PLANNER", $"Waiting {retrySeconds}s cooldown for {model} RPM reset...");
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

                    continue; // Fail over to next candidate model with independent quota
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

    private ProposedCurriculum ParsePlanJson(string json, int defaultLevel)
    {
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            int level = root.TryGetProperty("level", out var l) ? l.GetInt32() : defaultLevel;
            var subjects = new List<ProposedSubjectDto>();

            if (root.TryGetProperty("subjects", out var subjectsArray) && subjectsArray.ValueKind == JsonValueKind.Array)
            {
                int autoPos = 1;
                foreach (var el in subjectsArray.EnumerateArray())
                {
                    var typeStr = el.TryGetProperty("type", out var tp) ? tp.GetString() ?? "Kanji" : "Kanji";
                    var sType = Enum.TryParse<SubjectType>(typeStr, true, out var st) ? st : SubjectType.Kanji;
                    var character = el.TryGetProperty("character", out var ch) ? ch.GetString() ?? "" : "";
                    int sLevel = el.TryGetProperty("level", out var lv) ? lv.GetInt32() : level;
                    int lessonPos = el.TryGetProperty("lessonPosition", out var lp) ? lp.GetInt32() : autoPos++;

                    var components = new List<string>();
                    if (el.TryGetProperty("componentCharacters", out var compEl) && compEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var c in compEl.EnumerateArray())
                        {
                            var s = c.GetString();
                            if (!string.IsNullOrWhiteSpace(s)) components.Add(s.Trim());
                        }
                    }

                    var meanings = new List<ProposedMeaningDto>();
                    if (el.TryGetProperty("meanings", out var meanEl) && meanEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var m in meanEl.EnumerateArray())
                        {
                            if (m.ValueKind == JsonValueKind.Object)
                            {
                                var mText = m.TryGetProperty("meaning", out var mt) ? mt.GetString() ?? "" : "";
                                bool isPrim = !m.TryGetProperty("isPrimary", out var ip) || ip.GetBoolean();
                                var alt = m.TryGetProperty("alternatives", out var at) ? at.GetString() : null;
                                if (!string.IsNullOrWhiteSpace(mText))
                                {
                                    meanings.Add(new ProposedMeaningDto(mText.Trim(), isPrim, alt));
                                }
                            }
                            else if (m.ValueKind == JsonValueKind.String)
                            {
                                var mText = m.GetString();
                                if (!string.IsNullOrWhiteSpace(mText))
                                {
                                    meanings.Add(new ProposedMeaningDto(mText.Trim(), meanings.Count == 0, null));
                                }
                            }
                        }
                    }

                    var readings = new List<ProposedReadingDto>();
                    if (el.TryGetProperty("readings", out var readEl) && readEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var r in readEl.EnumerateArray())
                        {
                            if (r.ValueKind == JsonValueKind.Object)
                            {
                                var rText = r.TryGetProperty("reading", out var rt) ? rt.GetString() ?? "" : "";
                                var rType = r.TryGetProperty("type", out var rtp) ? rtp.GetString() ?? "Onyomi" : "Onyomi";
                                bool isPrim = !r.TryGetProperty("isPrimary", out var ip) || ip.GetBoolean();
                                var alt = r.TryGetProperty("alternatives", out var at) ? at.GetString() : null;
                                if (!string.IsNullOrWhiteSpace(rText))
                                {
                                    readings.Add(new ProposedReadingDto(rText.Trim(), rType, isPrim, alt));
                                }
                            }
                            else if (r.ValueKind == JsonValueKind.String)
                            {
                                var rText = r.GetString();
                                if (!string.IsNullOrWhiteSpace(rText))
                                {
                                    readings.Add(new ProposedReadingDto(rText.Trim(), "Onyomi", readings.Count == 0, null));
                                }
                            }
                        }
                    }

                    subjects.Add(new ProposedSubjectDto(
                        Type: sType,
                        Character: character.Trim(),
                        Level: sLevel,
                        LessonPosition: lessonPos,
                        ComponentCharacters: components,
                        Meanings: meanings,
                        Readings: readings
                    ));
                }
            }

            return new ProposedCurriculum(level, subjects);
        }
        catch (Exception ex)
        {
            throw new FormatException($"Failed to parse curriculum plan JSON: {ex.Message}", ex);
        }
    }
}
