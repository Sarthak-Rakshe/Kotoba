using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Kotoba.DataAccess.Context;
using Kotoba.DataAccess.Entities;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class GeminiContentGenerator : IAiContentGenerator
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

    private readonly KotobaDbContext _context;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;
    private readonly IProgressionService _progressionService;
    private readonly ISystemLogService? _logService;

    public GeminiContentGenerator(
        KotobaDbContext context,
        IConfiguration config,
        HttpClient httpClient,
        IProgressionService progressionService,
        ISystemLogService? logService = null)
    {
        _context = context;
        _config = config;
        _httpClient = httpClient;
        _progressionService = progressionService;
        _logService = logService;
    }

    private async Task<(bool Success, string Raw, string Json, string? Error, string UsedModel)> ExecuteGeminiPromptAsync(
        string prompt,
        string? preferredModel = null)
    {
        var apiKey = _config["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return (false, "GEMINI_API_KEY not configured.", "{}", "GEMINI_API_KEY is missing from configuration and environment.", "None");
        }

        // Build list of models to try, starting with preferred model
        var modelsToTry = new List<string>();
        if (!string.IsNullOrWhiteSpace(preferredModel))
        {
            modelsToTry.Add(preferredModel);
        }
        foreach (var m in CandidateModels)
        {
            if (!modelsToTry.Contains(m))
            {
                modelsToTry.Add(m);
            }
        }

        string lastRaw = "";
        string? lastError = null;
        string lastModel = modelsToTry.First();

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
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        responseMimeType = "application/json",
                        maxOutputTokens = 65536   // Gemini 2.x Flash supports up to 65536 output tokens
                    }
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                lastRaw = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    lastError = $"Model {model} returned HTTP {response.StatusCode}";
                    continue; // Try next model candidate
                }

                var extractedText = ExtractCandidateText(lastRaw);
                // Verify the JSON is complete (not truncated by token limit)
                try
                {
                    using var testDoc = JsonDocument.Parse(extractedText);
                    return (true, lastRaw, extractedText, null, model);
                }
                catch (JsonException jsonEx)
                {
                    // JSON is truncated — pass the raw text through so partial recovery can salvage complete objects
                    lastError = $"Model {model} failed: {jsonEx.Message}";
                    lastRaw = extractedText; // expose for TryRecoverSubjectsFromTruncatedJson
                    continue;
                }
            }
            catch (Exception ex)
            {
                lastError = $"Model {model} failed: {ex.Message}";
            }
        }

        // Return the last extracted text (even if truncated) so partial recovery can run on it
        return (false, lastRaw, lastRaw, lastError ?? "All candidate Gemini models failed.", lastModel);
    }

    public async Task<AiGenerateResponse> GenerateAndSaveContentAsync(AiGenerateRequest request)
    {
        var configuredModel = _config["Gemini:Model"] ?? Environment.GetEnvironmentVariable("GEMINI_MODEL") ?? "gemini-3.5-flash";
        var prompt = BuildPrompt(request.Type, request.Character, request.Level);

        var (success, rawResponse, parsedJson, error, usedModel) = await ExecuteGeminiPromptAsync(prompt, configuredModel);

        if (!success)
        {
            parsedJson = GenerateFallbackJson(request.Type, request.Character, request.Level);
        }

        // Check if subject already exists in curriculum to inform the user
        var alreadyInCurriculum = await _context.Subjects.AnyAsync(s => s.Character == request.Character && s.Type == request.Type);
        var validation = error;
        if (alreadyInCurriculum)
        {
            validation = (validation == null ? "" : validation + " | ") + "Already exists in central curriculum. Approving will update it.";
        }

        var aiContent = new AiGeneratedContent
        {
            SubjectType = request.Type,
            TargetCharacter = request.Character,
            RawResponse = rawResponse,
            ParsedContentJson = parsedJson,
            Provider = success ? "Gemini" : "Gemini (Fallback Used)",
            Model = usedModel,
            Status = success ? AiContentStatus.Pending : AiContentStatus.NeedsReview,
            ValidationErrors = validation,
            CreatedAt = DateTime.UtcNow
        };

        _context.AiGeneratedContents.Add(aiContent);
        await _context.SaveChangesAsync();

        return new AiGenerateResponse(
            Id: aiContent.Id,
            Type: aiContent.SubjectType,
            Character: aiContent.TargetCharacter,
            Provider: aiContent.Provider,
            Model: aiContent.Model,
            Status: aiContent.Status,
            ParsedContentJson: aiContent.ParsedContentJson,
            ValidationErrors: aiContent.ValidationErrors
        );
    }

    public async Task<List<AiGenerateResponse>> GenerateLevelBatchAsync(
        int level,
        string? theme = null,
        int? radicalCount = null,
        int? kanjiCount = null,
        int? vocabCount = null)
    {
        var configuredModel = _config["Gemini:Model"] ?? Environment.GetEnvironmentVariable("GEMINI_MODEL") ?? "gemini-3.5-flash";

        // Two supported presets:
        //   Express  → 4 Radicals, 6 Kanji, 8 Vocab  (18 total)
        //   Standard → 10 Radicals, 14 Kanji, 16 Vocab (40 total — WaniKani default)
        int rCount = Math.Clamp(radicalCount ?? 10, 4, 10);
        int kCount = Math.Clamp(kanjiCount ?? 14, 6, 14);
        int vCount = Math.Clamp(vocabCount ?? 16, 8, 16);

        var prompt = BuildLevelPrompt(level, theme, rCount, kCount, vCount);

        var (success, rawResponse, parsedJson, error, usedModel) = await ExecuteGeminiPromptAsync(prompt, configuredModel);
        var createdItems = new List<AiGeneratedContent>();

        if (success)
        {
            try
            {
                using var doc = JsonDocument.Parse(parsedJson);
                if (doc.RootElement.TryGetProperty("subjects", out var subjectsArray))
                {
                    foreach (var s in subjectsArray.EnumerateArray())
                    {
                        var typeStr = s.TryGetProperty("type", out var tp) ? tp.GetString() ?? "Kanji" : "Kanji";
                        var charStr = s.TryGetProperty("character", out var ch) ? ch.GetString() ?? "" : "";
                        var sType = Enum.TryParse<SubjectType>(typeStr, true, out var pt) ? pt : SubjectType.Kanji;

                        if (string.IsNullOrWhiteSpace(charStr)) continue;

                        var alreadyInCurriculum = await _context.Subjects.AnyAsync(sub => sub.Character == charStr && sub.Type == sType);

                        createdItems.Add(new AiGeneratedContent
                        {
                            SubjectType = sType,
                            TargetCharacter = charStr,
                            RawResponse = rawResponse,
                            ParsedContentJson = s.GetRawText(),
                            Provider = "Gemini",
                            Model = usedModel,
                            Status = AiContentStatus.Pending,
                            ValidationErrors = alreadyInCurriculum ? "Already present in central curriculum. Approving will update it." : null,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                error = $"JSON parsing error: {ex.Message}";
                success = false;
            }
        }

        if (!success || createdItems.Count == 0)
        {
            var fallbackBatch = GenerateFallbackLevelBatch(level);
            foreach (var item in fallbackBatch)
            {
                var alreadyInCurriculum = await _context.Subjects.AnyAsync(sub => sub.Character == item.Character && sub.Type == item.Type);

                createdItems.Add(new AiGeneratedContent
                {
                    SubjectType = item.Type,
                    TargetCharacter = item.Character,
                    RawResponse = rawResponse,
                    ParsedContentJson = item.Json,
                    Provider = "TemplateFallback",
                    Model = usedModel,
                    Status = AiContentStatus.NeedsReview,
                    ValidationErrors = $"AI API Error: {error}. Fallback template loaded.",
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        _context.AiGeneratedContents.AddRange(createdItems);
        await _context.SaveChangesAsync();

        return createdItems.Select(c => new AiGenerateResponse(
            Id: c.Id,
            Type: c.SubjectType,
            Character: c.TargetCharacter,
            Provider: c.Provider,
            Model: c.Model,
            Status: c.Status,
            ParsedContentJson: c.ParsedContentJson,
            ValidationErrors: c.ValidationErrors
        )).ToList();
    }

    public async Task<bool> RejectContentAsync(int aiContentId, string? reason = null)
    {
        var content = await _context.AiGeneratedContents.FindAsync(aiContentId);
        if (content == null) return false;

        content.Status = AiContentStatus.Rejected;
        content.ValidationErrors = reason ?? "Rejected by curriculum admin.";
        await _context.SaveChangesAsync();
        _logService?.LogInfo("AI", $"Rejected AI subject '{content.TargetCharacter}' ({content.SubjectType})", method: "REJECT", endpoint: $"/api/ai/reject/{aiContentId}");
        return true;
    }

    public async Task<int> RejectAllPendingAsync(SubjectType? type = null, string? reason = null)
    {
        var query = _context.AiGeneratedContents
            .Where(a => a.Status == AiContentStatus.Pending || a.Status == AiContentStatus.NeedsReview);
        if (type.HasValue)
        {
            query = query.Where(a => a.SubjectType == type.Value);
        }

        var items = await query.ToListAsync();
        int count = 0;
        foreach (var item in items)
        {
            item.Status = AiContentStatus.Rejected;
            item.ValidationErrors = reason ?? "Bulk rejected by curriculum admin.";
            count++;
        }
        await _context.SaveChangesAsync();
        _logService?.LogWarning("AI", $"Bulk rejected {count} pending AI subjects (Type: {type?.ToString() ?? "All"})", method: "REJECT-ALL", endpoint: "/api/ai/reject-all");
        return count;
    }

    public async Task<bool> UpdateContentAsync(int aiContentId, string updatedParsedJson)
    {
        var content = await _context.AiGeneratedContents.FindAsync(aiContentId);
        if (content == null) return false;

        try
        {
            using var doc = JsonDocument.Parse(updatedParsedJson);
            content.ParsedContentJson = updatedParsedJson;
            content.Status = AiContentStatus.Pending;
            content.ValidationErrors = null;
            await _context.SaveChangesAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<AiGenerateResponse?> RefineContentAsync(int aiContentId, string instruction)
    {
        var content = await _context.AiGeneratedContents.FindAsync(aiContentId);
        if (content == null) return null;

        var configuredModel = _config["Gemini:Model"] ?? Environment.GetEnvironmentVariable("GEMINI_MODEL") ?? "gemini-3.5-flash";
        var refinePrompt = $@"You are a Japanese curriculum expert.
Here is an existing JSON Japanese learning item:
{content.ParsedContentJson}

Instruction for refinement:
{instruction}

Return strictly the updated valid JSON preserving the exact schema.";

        var (success, raw, updatedJson, error, usedModel) = await ExecuteGeminiPromptAsync(refinePrompt, configuredModel);

        if (success)
        {
            content.ParsedContentJson = updatedJson;
            content.Status = AiContentStatus.Pending;
            content.ValidationErrors = null;
            content.Model = usedModel;
            await _context.SaveChangesAsync();
        }
        else
        {
            content.ValidationErrors = $"Refinement failed: {error}";
            await _context.SaveChangesAsync();
        }

        return new AiGenerateResponse(
            Id: content.Id,
            Type: content.SubjectType,
            Character: content.TargetCharacter,
            Provider: content.Provider,
            Model: content.Model,
            Status: content.Status,
            ParsedContentJson: content.ParsedContentJson,
            ValidationErrors: content.ValidationErrors
        );
    }

    public async Task<bool> ApproveContentAsync(int aiContentId)
    {
        var content = await _context.AiGeneratedContents.FindAsync(aiContentId);
        if (content == null || content.Status == AiContentStatus.Approved)
            return false;

        using var doc = JsonDocument.Parse(content.ParsedContentJson);
        var root = doc.RootElement;

        var character = root.TryGetProperty("character", out var ch) ? ch.GetString() ?? content.TargetCharacter : content.TargetCharacter;
        var level = root.TryGetProperty("level", out var l) ? l.GetInt32() : 1;
        var meaningHint = root.TryGetProperty("meaningHint", out var mh) ? mh.GetString() : null;

        // Check if subject already exists in central curriculum
        var existingSubject = await _context.Subjects
            .Include(s => s.Meanings)
            .Include(s => s.Readings)
            .Include(s => s.Mnemonics)
            .Include(s => s.ExampleSentences)
            .FirstOrDefaultAsync(s => s.Character == character && s.Type == content.SubjectType);

        Subject subject;
        if (existingSubject != null)
        {
            subject = existingSubject;
            subject.Level = level;
            subject.MeaningHint = meaningHint;

            // Remove previous child collections to avoid duplication
            _context.Meanings.RemoveRange(subject.Meanings);
            _context.Readings.RemoveRange(subject.Readings);
            _context.Mnemonics.RemoveRange(subject.Mnemonics);
            _context.ExampleSentences.RemoveRange(subject.ExampleSentences);
        }
        else
        {
            subject = new Subject
            {
                Character = character,
                Type = content.SubjectType,
                Level = level,
                MeaningHint = meaningHint
            };
            _context.Subjects.Add(subject);
        }

        // Add Meanings
        if (root.TryGetProperty("meanings", out var meaningsEl))
        {
            if (meaningsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var m in meaningsEl.EnumerateArray())
                {
                    if (m.ValueKind == JsonValueKind.Object)
                    {
                        subject.Meanings.Add(new Meaning
                        {
                            MeaningText = m.TryGetProperty("meaning", out var mt) ? mt.GetString() ?? "" : "",
                            IsPrimary = m.TryGetProperty("isPrimary", out var ip) && ip.GetBoolean(),
                            AcceptedAlternatives = m.TryGetProperty("alternatives", out var alt) ? alt.GetString() : null
                        });
                    }
                    else if (m.ValueKind == JsonValueKind.String)
                    {
                        subject.Meanings.Add(new Meaning
                        {
                            MeaningText = m.GetString() ?? "",
                            IsPrimary = subject.Meanings.Count == 0,
                            AcceptedAlternatives = null
                        });
                    }
                }
            }
        }

        // Ensure at least one primary meaning
        if (subject.Meanings.Count > 0 && !subject.Meanings.Any(m => m.IsPrimary))
        {
            subject.Meanings.First().IsPrimary = true;
        }

        // Add Readings
        if (root.TryGetProperty("readings", out var readingsEl))
        {
            if (readingsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var r in readingsEl.EnumerateArray())
                {
                    if (r.ValueKind == JsonValueKind.Object)
                    {
                        var typeStr = r.TryGetProperty("type", out var t) ? t.GetString() : "Onyomi";
                        var rType = typeStr switch
                        {
                            "Kunyomi" => ReadingType.Kunyomi,
                            "VocabularyReading" => ReadingType.VocabularyReading,
                            _ => ReadingType.Onyomi
                        };

                        subject.Readings.Add(new Reading
                        {
                            ReadingText = r.TryGetProperty("reading", out var rd) ? rd.GetString() ?? "" : "",
                            Type = rType,
                            IsPrimary = r.TryGetProperty("isPrimary", out var rip) && rip.GetBoolean(),
                            AcceptedAlternatives = r.TryGetProperty("alternatives", out var ralt) ? ralt.GetString() : null
                        });
                    }
                    else if (r.ValueKind == JsonValueKind.String)
                    {
                        subject.Readings.Add(new Reading
                        {
                            ReadingText = r.GetString() ?? "",
                            Type = content.SubjectType == SubjectType.Vocabulary ? ReadingType.VocabularyReading : ReadingType.Onyomi,
                            IsPrimary = subject.Readings.Count == 0
                        });
                    }
                }
            }
            else if (readingsEl.ValueKind == JsonValueKind.Object)
            {
                // Handles case where Gemini outputs { "onyomi": ["にち"], "kunyomi": ["ひ"] }
                if (readingsEl.TryGetProperty("onyomi", out var onArr) && onArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var o in onArr.EnumerateArray())
                    {
                        subject.Readings.Add(new Reading
                        {
                            ReadingText = o.GetString() ?? "",
                            Type = ReadingType.Onyomi,
                            IsPrimary = subject.Readings.Count == 0
                        });
                    }
                }
                if (readingsEl.TryGetProperty("kunyomi", out var kunArr) && kunArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var k in kunArr.EnumerateArray())
                    {
                        subject.Readings.Add(new Reading
                        {
                            ReadingText = k.GetString() ?? "",
                            Type = ReadingType.Kunyomi,
                            IsPrimary = subject.Readings.Count == 0
                        });
                    }
                }
            }
        }

        // Add Mnemonics
        if (root.TryGetProperty("mnemonics", out var mnemonicsEl) && mnemonicsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var mn in mnemonicsEl.EnumerateArray())
            {
                var typeStr = mn.TryGetProperty("type", out var mt) ? mt.GetString() : "Meaning";
                subject.Mnemonics.Add(new Mnemonic
                {
                    Type = typeStr == "Reading" ? ReviewType.Reading : ReviewType.Meaning,
                    Text = mn.TryGetProperty("text", out var txt) ? txt.GetString() ?? "" : "",
                    Hint = mn.TryGetProperty("hint", out var mnh) ? mnh.GetString() : null
                });
            }
        }
        else
        {
            // Handles direct keys "meaningMnemonic" / "readingMnemonic"
            if (root.TryGetProperty("meaningMnemonic", out var mm) && !string.IsNullOrWhiteSpace(mm.GetString()))
            {
                subject.Mnemonics.Add(new Mnemonic
                {
                    Type = ReviewType.Meaning,
                    Text = mm.GetString()!
                });
            }
            if (root.TryGetProperty("readingMnemonic", out var rm) && !string.IsNullOrWhiteSpace(rm.GetString()))
            {
                subject.Mnemonics.Add(new Mnemonic
                {
                    Type = ReviewType.Reading,
                    Text = rm.GetString()!
                });
            }
        }

        // Add Example Sentences
        if (root.TryGetProperty("exampleSentences", out var examplesEl) && examplesEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var ex in examplesEl.EnumerateArray())
            {
                subject.ExampleSentences.Add(new ExampleSentence
                {
                    Japanese = ex.TryGetProperty("japanese", out var jp) ? jp.GetString() ?? "" : "",
                    English = ex.TryGetProperty("english", out var en) ? en.GetString() ?? "" : "",
                    Furigana = ex.TryGetProperty("furigana", out var f) ? f.GetString() : null
                });
            }
        }

        await _context.SaveChangesAsync();

        // Establish component dependencies
        if (root.TryGetProperty("componentCharacters", out var compEl) && compEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var comp in compEl.EnumerateArray())
            {
                var compChar = comp.GetString();
                if (!string.IsNullOrEmpty(compChar))
                {
                    var parentSubject = await _context.Subjects.FirstOrDefaultAsync(s => s.Character == compChar);
                    if (parentSubject != null && parentSubject.Id != subject.Id)
                    {
                        var depExists = await _context.SubjectDependencies.AnyAsync(sd => sd.ParentSubjectId == parentSubject.Id && sd.ChildSubjectId == subject.Id);
                        if (!depExists)
                        {
                            _context.SubjectDependencies.Add(new SubjectDependency
                            {
                                ParentSubjectId = parentSubject.Id,
                                ChildSubjectId = subject.Id,
                                DependencyType = subject.Type == SubjectType.Vocabulary ? DependencyType.VocabularyKanji : DependencyType.Component
                            });
                        }
                    }
                }
            }
            await _context.SaveChangesAsync();
        }

        content.Status = AiContentStatus.Approved;
        content.ApprovedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Unlock for all learners on or above this level
        var usersOnLevel = await _context.Users.Where(u => u.CurrentLevel >= level).Select(u => u.Id).ToListAsync();
        foreach (var uId in usersOnLevel)
        {
            await _progressionService.UnlockInitialSubjectsForUserAsync(uId, level);
        }

        _logService?.LogInfo("DECK", $"Approved subject '{character}' ({content.SubjectType}) into central curriculum", method: "APPROVE", endpoint: $"/api/ai/approve/{aiContentId}");
        return true;
    }

    public async Task<int> ApproveAllPendingAsync(SubjectType? type = null)
    {
        var query = _context.AiGeneratedContents
            .Where(a => a.Status == AiContentStatus.Pending || a.Status == AiContentStatus.NeedsReview);
        if (type.HasValue)
        {
            query = query.Where(a => a.SubjectType == type.Value);
        }

        var pendingIds = await query.Select(a => a.Id).ToListAsync();
        int approvedCount = 0;
        foreach (var id in pendingIds)
        {
            try
            {
                if (await ApproveContentAsync(id))
                {
                    approvedCount++;
                }
            }
            catch (Exception ex)
            {
                _logService?.LogError("AI", $"Failed approving subject ID {id} during bulk approval", ex);
            }
        }

        _logService?.LogInfo("DECK", $"Bulk approved {approvedCount}/{pendingIds.Count} pending subjects into central curriculum", method: "APPROVE-ALL", endpoint: "/api/ai/approve-all");
        return approvedCount;
    }

    public async Task<(bool Success, string Json, string? Error)> GenerateSingleRawJsonAsync(SubjectType type, string character, int level)
    {
        var configuredModel = _config["Gemini:Model"] ?? Environment.GetEnvironmentVariable("GEMINI_MODEL") ?? "gemini-3.5-flash";
        var prompt = BuildPrompt(type, character, level);
        var (success, raw, json, error, usedModel) = await ExecuteGeminiPromptAsync(prompt, configuredModel);
        if (!success)
        {
            json = GenerateFallbackJson(type, character, level);
            _logService?.LogWarning("AI", $"Single prompt generation fallback used for '{character}': {error}");
        }
        else
        {
            _logService?.LogInfo("AI", $"Generated single subject data for '{character}' using {usedModel}");
        }
        return (true, json, error);
    }

    private string BuildPrompt(SubjectType type, string character, int level)
    {
        return $@"You are an expert Japanese curriculum designer creating original educational content for learning Japanese.
Generate learning content for the following Japanese {type}:
Character: '{character}'
Target Level: {level}

Requirements:
1. Provide accurate Japanese meanings and readings.
2. For mnemonics, write an original, highly memorable story to help English speakers remember the character. DO NOT copy WaniKani mnemonics.
3. For vocabulary, provide a natural Japanese example sentence with English translation and furigana markup.

Output strictly valid JSON with this exact structure:
{{
  ""character"": ""{character}"",
  ""level"": {level},
  ""meaningHint"": ""Short explanation of visual or structural concept."",
  ""meanings"": [
    {{ ""meaning"": ""Primary English Meaning"", ""isPrimary"": true, ""alternatives"": ""Alt1, Alt2"" }}
  ],
  ""readings"": [
    {{ ""reading"": ""ひらがな"", ""type"": ""Onyomi"" or ""Kunyomi"" or ""VocabularyReading"", ""isPrimary"": true, ""alternatives"": """" }}
  ],
  ""mnemonics"": [
    {{ ""type"": ""Meaning"", ""text"": ""Original vivid story connecting parts to meaning."", ""hint"": ""Recall tip"" }},
    {{ ""type"": ""Reading"", ""text"": ""Original phonetic story connecting to pronunciation."", ""hint"": ""Pronunciation tip"" }}
  ],
  ""exampleSentences"": [
    {{ ""japanese"": ""日本語例文。"", ""english"": ""English translation."", ""furigana"": ""日本語[にほんご]例文[れいぶん]。"" }}
  ]
}}";
    }

    private string ExtractCandidateText(string rawResponse)
    {
        try
        {
            using var doc = JsonDocument.Parse(rawResponse);
            var candidates = doc.RootElement.GetProperty("candidates");
            if (candidates.GetArrayLength() > 0)
            {
                var content = candidates[0].GetProperty("content");
                var parts = content.GetProperty("parts");
                if (parts.GetArrayLength() > 0)
                {
                    var text = parts[0].GetProperty("text").GetString() ?? "{}";
                    // Strip optional markdown code fences if model enclosed in ```json ... ```
                    var match = Regex.Match(text, @"```(?:json)?\s*([\s\S]*?)\s*```");
                    return match.Success ? match.Groups[1].Value.Trim() : text.Trim();
                }
            }
        }
        catch { }
        return rawResponse;
    }

    private string GenerateFallbackJson(SubjectType type, string character, int level)
    {
        return JsonSerializer.Serialize(new
        {
            character = character,
            level = level,
            meaningHint = $"Visual building block for {character}",
            meanings = new[]
            {
                new { meaning = character switch { "山" => "Mountain", "川" => "River", "雨" => "Rain", _ => "Study Item" }, isPrimary = true, alternatives = "" }
            },
            readings = type == SubjectType.Radical ? Array.Empty<object>() : new[]
            {
                new { reading = character switch { "山" => "さん", "川" => "かわ", "雨" => "あめ", _ => "あ" }, type = "Onyomi", isPrimary = true, alternatives = "" }
            },
            mnemonics = new[]
            {
                new { type = "Meaning", text = $"Original mnemonic: Picture {character} clearly in your mind.", hint = "Visualize character structure." }
            },
            exampleSentences = type != SubjectType.Vocabulary ? Array.Empty<object>() : new[]
            {
                new { japanese = $"{character}があります。", english = $"There is {character}.", furigana = $"{character}があります。" }
            }
        }, new JsonSerializerOptions { WriteIndented = true });
    }

    private string BuildLevelPrompt(int level, string? theme, int radicalCount, int kanjiCount, int vocabCount)
    {
        var themeClause = string.IsNullOrWhiteSpace(theme) ? "" : $" with pedagogical focus or theme '{theme}'";

        return $@"You are a world-class Japanese curriculum architect designing a comprehensive, authentic WaniKani-style Level {level} curriculum pack{themeClause}.

Generate a rigorous, interconnected learning set following WaniKani's proven pedagogy:
- EXACTLY {radicalCount} Radicals (foundational visual building blocks appropriate for Level {level})
- EXACTLY {kanjiCount} Kanji (formed using the generated radicals, with Onyomi & Kunyomi)
- EXACTLY {vocabCount} Vocabulary words (practical high-frequency Japanese words utilizing the generated kanji)

PEDAGOGICAL & STRUCTURAL RULES:
1. Strict Progression: Kanji must logically build upon the generated Radicals. Vocabulary words must use the generated Kanji.
2. Character Accuracy:
   - For Radicals: Must be valid Japanese radical components (e.g. 一, 丨, 丶, 丿, 乙, 二, 十, 人, 入, 八, 刀, 力, 又, 口, 土, 女, 子, 寸, 小, 山, 川, 工, etc.) with accurate English names.
   - For Kanji: Provide both Onyomi and Kunyomi readings in Hiragana (e.g., onyomi: 'こう', kunyomi: 'す').
   - For Vocabulary: Provide genuine Hiragana pronunciation and natural Japanese example sentences with furigana markup: '漢字[かんじ]の 例文[れいぶん]です。'
3. High-Impact Mnemonics (DO NOT COPY WANIKANI WORD-FOR-WORD; write original, vivid stories):
   - Meaning Mnemonic: Vivid, memorable imagery connecting visual strokes/radicals to the core concept.
   - Reading Mnemonic: Clever phonetic associations connecting pronunciation (e.g. 'kou', 'shou', 'suki') to the story.
4. 'componentCharacters':
   - For Kanji: List the radical characters it is made from (e.g. [""女"", ""子""]).
   - For Vocabulary: List the kanji characters it contains (e.g. [""好""]).

Output strictly valid JSON with this exact structure (pure JSON, no markdown formatting):
{{
  ""subjects"": [
    {{
      ""type"": ""Radical"",
      ""character"": ""女"",
      ""level"": {level},
      ""meaningHint"": ""Woman standing gracefully."",
      ""componentCharacters"": [],
      ""meanings"": [
        {{ ""meaning"": ""Woman"", ""isPrimary"": true, ""alternatives"": ""Female"" }}
      ],
      ""readings"": [],
      ""mnemonics"": [
        {{ ""type"": ""Meaning"", ""text"": ""Notice the crossed legs and gentle arms of a graceful woman."", ""hint"": ""Woman"" }}
      ],
      ""exampleSentences"": []
    }},
    {{
      ""type"": ""Kanji"",
      ""character"": ""好"",
      ""level"": {level},
      ""meaningHint"": ""Woman and child together represent affection."",
      ""componentCharacters"": [""女"", ""子""],
      ""meanings"": [
        {{ ""meaning"": ""Like"", ""isPrimary"": true, ""alternatives"": ""Fond"" }}
      ],
      ""readings"": [
        {{ ""reading"": ""こう"", ""type"": ""Onyomi"", ""isPrimary"": true, ""alternatives"": """" }},
        {{ ""reading"": ""す"", ""type"": ""Kunyomi"", ""isPrimary"": false, ""alternatives"": """" }}
      ],
      ""mnemonics"": [
        {{ ""type"": ""Meaning"", ""text"": ""A woman (女) holding her beloved child (子) is a sight everyone likes (好)."", ""hint"": ""Affection"" }},
        {{ ""type"": ""Reading"", ""text"": ""You like to drink KO- (こう) cold brew coffee with your family."", ""hint"": ""Kou"" }}
      ],
      ""exampleSentences"": []
    }},
    {{
      ""type"": ""Vocabulary"",
      ""character"": ""好き"",
      ""level"": {level},
      ""meaningHint"": ""To like or be fond of something."",
      ""componentCharacters"": [""好""],
      ""meanings"": [
        {{ ""meaning"": ""Liked"", ""isPrimary"": true, ""alternatives"": ""Favorite, Fond of"" }}
      ],
      ""readings"": [
        {{ ""reading"": ""すき"", ""type"": ""VocabularyReading"", ""isPrimary"": true, ""alternatives"": """" }}
      ],
      ""mnemonics"": [
        {{ ""type"": ""Meaning"", ""text"": ""When you like (好) something, you give it your full attention."", ""hint"": ""Fond"" }},
        {{ ""type"": ""Reading"", ""text"": ""Read as SUKI (すき). Imagine skiing (suki) down snowy slopes which you really like."", ""hint"": ""Suki"" }}
      ],
      ""exampleSentences"": [
        {{
          ""japanese"": ""日本語が好きです。"",
          ""english"": ""I like Japanese."",
          ""furigana"": ""日本語[にほんご]が 好[す]きです。""
        }}
      ]
    }}
  ]
}}";
    }

    private List<(SubjectType Type, string Character, string Json)> GenerateFallbackLevelBatch(int level)
    {
        var items = new List<(SubjectType, string, string)>();

        items.Add((SubjectType.Radical, "火", JsonSerializer.Serialize(new
        {
            type = "Radical",
            character = "火",
            level = level,
            meaningHint = "Dancing tongues of fire.",
            componentCharacters = Array.Empty<string>(),
            meanings = new[] { new { meaning = "Fire", isPrimary = true, alternatives = "Flame" } },
            readings = Array.Empty<object>(),
            mnemonics = new[] { new { type = "Meaning", text = "Sparks leaping out of a roaring campfire.", hint = "Fire" } },
            exampleSentences = Array.Empty<object>()
        })));

        items.Add((SubjectType.Radical, "水", JsonSerializer.Serialize(new
        {
            type = "Radical",
            character = "水",
            level = level,
            meaningHint = "A central stream with splashing droplets.",
            componentCharacters = Array.Empty<string>(),
            meanings = new[] { new { meaning = "Water", isPrimary = true, alternatives = "" } },
            readings = Array.Empty<object>(),
            mnemonics = new[] { new { type = "Meaning", text = "Water splashing out in droplets from a central fountain.", hint = "Water" } },
            exampleSentences = Array.Empty<object>()
        })));

        items.Add((SubjectType.Kanji, "火", JsonSerializer.Serialize(new
        {
            type = "Kanji",
            character = "火",
            level = level,
            meaningHint = "Kanji for fire.",
            componentCharacters = new[] { "火" },
            meanings = new[] { new { meaning = "Fire", isPrimary = true, alternatives = "" } },
            readings = new[]
            {
                new { reading = "か", type = "Onyomi", isPrimary = true, alternatives = "" },
                new { reading = "ひ", type = "Kunyomi", isPrimary = false, alternatives = "" }
            },
            mnemonics = new[]
            {
                new { type = "Meaning", text = "The fire kanji burns with fierce flames.", hint = "Fire" },
                new { type = "Reading", text = "Say KA (か) like a hot burning candle.", hint = "Ka" }
            },
            exampleSentences = Array.Empty<object>()
        })));

        items.Add((SubjectType.Vocabulary, "火", JsonSerializer.Serialize(new
        {
            type = "Vocabulary",
            character = "火",
            level = level,
            meaningHint = "Standalone word for fire.",
            componentCharacters = new[] { "火" },
            meanings = new[] { new { meaning = "Fire", isPrimary = true, alternatives = "" } },
            readings = new[] { new { reading = "ひ", type = "VocabularyReading", isPrimary = true, alternatives = "" } },
            mnemonics = new[]
            {
                new { type = "Meaning", text = "The standalone word for fire.", hint = "Fire" },
                new { type = "Reading", text = "Read as hi (ひ) like heat.", hint = "Hi" }
            },
            exampleSentences = new[]
            {
                new { japanese = "火に注意してください。", english = "Please be careful with fire.", furigana = "火[ひ]に 注意[ちゅうい]してください。" }
            }
        })));

        return items;
    }
}
