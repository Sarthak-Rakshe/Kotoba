using System.Text.RegularExpressions;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class CurriculumValidationService : ICurriculumValidationService
{
    // CJK Unified Ideographs (Common & Rare blocks)
    private static readonly Regex KanjiRegex = new(@"^[\u4E00-\u9FAF\u3400-\u4DBF]$", RegexOptions.Compiled);

    // Kana (Hiragana, Katakana, small kana, prolonged sound mark, middle dot)
    private static readonly Regex ReadingRegex = new(@"^[\u3040-\u309F\u30A0-\u30FFー・]+$", RegexOptions.Compiled);

    // Japanese Text (Kanji + Kana)
    private static readonly Regex JapaneseWordRegex = new(@"^[\u4E00-\u9FAF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FFー]+$", RegexOptions.Compiled);

    public bool IsValidKanji(string character)
    {
        if (string.IsNullOrWhiteSpace(character)) return false;
        return KanjiRegex.IsMatch(character.Trim());
    }

    public bool IsValidReading(string reading)
    {
        if (string.IsNullOrWhiteSpace(reading)) return false;
        return ReadingRegex.IsMatch(reading.Trim());
    }

    public bool IsValidJapaneseVocabulary(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        return JapaneseWordRegex.IsMatch(text.Trim());
    }

    public CurriculumValidationResult ValidateProposedCurriculum(
        ProposedCurriculum proposal,
        CurriculumContext context,
        LevelRequirements requirements)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        var validSubjects = new List<ProposedSubjectDto>();
        var invalidSubjects = new List<ProposedSubjectDto>();

        if (proposal == null || proposal.Subjects == null || proposal.Subjects.Count == 0)
        {
            errors.Add("Proposal contains no subjects.");
            return new CurriculumValidationResult(false, errors, warnings, validSubjects, invalidSubjects);
        }

        // Sets of known characters from previous database levels
        var knownComponentsSet = new HashSet<string>(context.KnownComponents, StringComparer.Ordinal);
        var knownKanjiSet = new HashSet<string>(context.KnownKanji, StringComparer.Ordinal);
        var knownVocabSet = new HashSet<string>(context.KnownVocabulary, StringComparer.Ordinal);
        var allKnownSet = new HashSet<string>(context.KnownComponents.Concat(context.KnownKanji).Concat(context.KnownVocabulary), StringComparer.Ordinal);

        // Sets of characters introduced in the current proposal
        var proposedRadicals = proposal.Subjects
            .Where(s => s.Type == SubjectType.Radical)
            .Select(s => s.Character)
            .ToHashSet(StringComparer.Ordinal);

        var proposedKanji = proposal.Subjects
            .Where(s => s.Type == SubjectType.Kanji)
            .Select(s => s.Character)
            .ToHashSet(StringComparer.Ordinal);

        // Track characters already accepted in this batch to prevent internal duplicates
        var seenInBatch = new HashSet<string>(StringComparer.Ordinal);
        var seenLessonPositions = new HashSet<int>();

        // Map characters to their lesson position within this proposal
        var characterPositionMap = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var s in proposal.Subjects.Where(s => !string.IsNullOrWhiteSpace(s.Character)))
        {
            characterPositionMap[s.Character.Trim()] = s.LessonPosition;
        }

        foreach (var subject in proposal.Subjects)
        {
            var itemErrors = new List<string>();
            var charStr = subject.Character?.Trim() ?? "";

            // 1. Basic Character & Level Validation
            if (string.IsNullOrWhiteSpace(charStr))
            {
                itemErrors.Add("Character cannot be empty.");
            }
            if (subject.Level != requirements.Level)
            {
                itemErrors.Add($"Subject level {subject.Level} does not match required level {requirements.Level}.");
            }

            // 2. Duplicate Check Against Database History
            if (allKnownSet.Contains(charStr))
            {
                itemErrors.Add($"'{charStr}' already exists in previously learned curriculum (Level < {requirements.Level}). Duplicates are forbidden.");
            }

            // 3. Duplicate Check Within Batch
            if (seenInBatch.Contains(charStr))
            {
                itemErrors.Add($"'{charStr}' is duplicated within this level proposal.");
            }
            else
            {
                seenInBatch.Add(charStr);
            }

            // 4. Type-Specific Character & Reading Validation
            switch (subject.Type)
            {
                case SubjectType.Radical:
                    if (string.IsNullOrWhiteSpace(charStr))
                    {
                        itemErrors.Add("Radical character cannot be empty.");
                    }
                    if (subject.Meanings == null || subject.Meanings.Count == 0 || string.IsNullOrWhiteSpace(subject.Meanings[0].Meaning))
                    {
                        itemErrors.Add($"Radical '{charStr}' must have at least one meaning.");
                    }
                    break;

                case SubjectType.Kanji:
                    if (!IsValidKanji(charStr))
                    {
                        itemErrors.Add($"Kanji '{charStr}' is not a valid CJK ideograph character.");
                    }
                    if (subject.Meanings == null || subject.Meanings.Count == 0 || string.IsNullOrWhiteSpace(subject.Meanings[0].Meaning))
                    {
                        itemErrors.Add($"Kanji '{charStr}' must have at least one meaning.");
                    }
                    if (subject.Readings == null || subject.Readings.Count == 0 || string.IsNullOrWhiteSpace(subject.Readings[0].Reading))
                    {
                        itemErrors.Add($"Kanji '{charStr}' must have at least one reading.");
                    }
                    else
                    {
                        foreach (var r in subject.Readings)
                        {
                            if (!IsValidReading(r.Reading))
                            {
                                itemErrors.Add($"Kanji '{charStr}' has invalid reading '{r.Reading}'. Readings must be Kana.");
                            }
                        }
                    }
                    break;

                case SubjectType.Vocabulary:
                    if (!IsValidJapaneseVocabulary(charStr))
                    {
                        itemErrors.Add($"Vocabulary '{charStr}' is not valid Japanese text.");
                    }
                    if (subject.Meanings == null || subject.Meanings.Count == 0 || string.IsNullOrWhiteSpace(subject.Meanings[0].Meaning))
                    {
                        itemErrors.Add($"Vocabulary '{charStr}' must have at least one meaning.");
                    }
                    if (subject.Readings == null || subject.Readings.Count == 0 || string.IsNullOrWhiteSpace(subject.Readings[0].Reading))
                    {
                        itemErrors.Add($"Vocabulary '{charStr}' must have at least one reading.");
                    }
                    else
                    {
                        foreach (var r in subject.Readings)
                        {
                            if (!IsValidReading(r.Reading))
                            {
                                itemErrors.Add($"Vocabulary '{charStr}' has invalid reading '{r.Reading}'. Readings must be Kana.");
                            }
                        }
                    }
                    break;

                default:
                    itemErrors.Add($"Unknown subject type '{subject.Type}'.");
                    break;
            }

            // 5. Dependency & Component Validation
            if (subject.ComponentCharacters != null && subject.ComponentCharacters.Count > 0)
            {
                foreach (var component in subject.ComponentCharacters.Where(c => !string.IsNullOrWhiteSpace(c)))
                {
                    var compTrim = component.Trim();

                    // Check whether component is known from earlier levels or introduced in this level
                    bool isKnownOrProposed = knownComponentsSet.Contains(compTrim)
                        || knownKanjiSet.Contains(compTrim)
                        || proposedRadicals.Contains(compTrim)
                        || proposedKanji.Contains(compTrim);

                    if (!isKnownOrProposed)
                    {
                        warnings.Add($"Subject '{charStr}' references component '{compTrim}' which is neither in known curriculum nor in proposed components.");
                    }

                    // Check lesson order: if component is in the same level, it must be introduced before this subject
                    if (characterPositionMap.TryGetValue(compTrim, out var compPos))
                    {
                        if (compPos >= subject.LessonPosition)
                        {
                            itemErrors.Add($"Subject '{charStr}' (position {subject.LessonPosition}) depends on '{compTrim}' (position {compPos}) which appears at the same time or later in this level.");
                        }
                    }
                }
            }

            // 6. Lesson Position Check
            if (subject.LessonPosition <= 0)
            {
                itemErrors.Add($"Subject '{charStr}' has invalid lesson position {subject.LessonPosition}.");
            }
            if (seenLessonPositions.Contains(subject.LessonPosition))
            {
                warnings.Add($"Lesson position {subject.LessonPosition} is used by more than one subject. Ordering will be normalized.");
            }
            else
            {
                seenLessonPositions.Add(subject.LessonPosition);
            }

            if (itemErrors.Count > 0)
            {
                errors.AddRange(itemErrors);
                invalidSubjects.Add(subject);
            }
            else
            {
                validSubjects.Add(subject);
            }
        }

        // Check subject counts
        int radCount = validSubjects.Count(s => s.Type == SubjectType.Radical);
        int kanCount = validSubjects.Count(s => s.Type == SubjectType.Kanji);
        int vocCount = validSubjects.Count(s => s.Type == SubjectType.Vocabulary);

        if (radCount < Math.Min(requirements.RadicalCount, 2))
        {
            errors.Add($"Insufficient valid radicals ({radCount} valid, expected {requirements.RadicalCount}).");
        }
        if (kanCount < Math.Min(requirements.KanjiCount, 3))
        {
            errors.Add($"Insufficient valid kanji ({kanCount} valid, expected {requirements.KanjiCount}).");
        }
        if (vocCount < Math.Min(requirements.VocabCount, 4))
        {
            errors.Add($"Insufficient valid vocabulary ({vocCount} valid, expected {requirements.VocabCount}).");
        }

        bool overallValid = errors.Count == 0 && invalidSubjects.Count == 0;
        return new CurriculumValidationResult(overallValid, errors, warnings, validSubjects, invalidSubjects);
    }
}
