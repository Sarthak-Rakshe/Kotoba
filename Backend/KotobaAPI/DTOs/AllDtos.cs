using Kotoba.Utility.Enums;

namespace KotobaAPI.DTOs;

public record RegisterRequest(string Username, string Email, string Password);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, int UserId, string Username, string Email, int CurrentLevel, bool IsAdmin);

public record MeaningDto(int Id, string MeaningText, bool IsPrimary, string? AcceptedAlternatives);
public record ReadingDto(int Id, string ReadingText, ReadingType Type, bool IsPrimary, string? AcceptedAlternatives);
public record MnemonicDto(int Id, ReviewType Type, string Text, string? Hint);
public record ExampleSentenceDto(int Id, string Japanese, string English, string? Furigana);

public record SubjectDetailDto(
    int Id,
    string Character,
    SubjectType Type,
    int Level,
    string? MeaningHint,
    string? ReadingHint,
    List<MeaningDto> Meanings,
    List<ReadingDto> Readings,
    List<MnemonicDto> Mnemonics,
    List<ExampleSentenceDto> ExampleSentences,
    List<string> ComponentCharacters,
    int LessonPosition = 1
);

public record SubjectSummaryDto(
    int Id,
    string Character,
    SubjectType Type,
    int Level,
    string PrimaryMeaning,
    string? PrimaryReading,
    SrsStage Stage,
    bool IsUnlocked,
    int LessonPosition = 1
);

public record LessonItemDto(
    int SubjectId,
    string Character,
    SubjectType Type,
    int Level,
    string? MeaningHint,
    string? ReadingHint,
    List<MeaningDto> Meanings,
    List<ReadingDto> Readings,
    List<MnemonicDto> Mnemonics,
    List<ExampleSentenceDto> ExampleSentences,
    List<string> Components
);

public record CompleteLessonRequest(int SubjectId);

public record ReviewQueueItemDto(
    int SrsItemId,
    int SubjectId,
    string Character,
    SubjectType Type,
    int Level,
    ReviewType ReviewType,
    List<string> AcceptedMeanings,
    List<string> AcceptedReadings
);

public record SubmitReviewRequest(
    int SrsItemId,
    ReviewType ReviewType,
    string SubmittedAnswer,
    int ResponseTimeMs
);

public record SubmitReviewResponse(
    bool IsCorrect,
    bool HasTypoWarning,
    string SubmittedAnswer,
    SrsStage PreviousStage,
    SrsStage NewStage,
    DateTime? NextReviewAt,
    List<string> UnlockedSubjects,
    bool LeveledUp,
    int? NewLevel
);

public record HourlyForecastItem(string TimeLabel, DateTime Timestamp, int Count, int CumulativeCount);
public record DailyForecastItem(string DayLabel, DateTime Date, int Count);
public record ReviewForecastDto(
    int DueNow,
    List<HourlyForecastItem> Next24Hours,
    List<DailyForecastItem> Next7Days
);

public record SrsDistributionDto(
    int Locked,
    int Initiate,
    int Apprentice,
    int Guru,
    int Master,
    int Enlightened,
    int Burned
);

public record DashboardStatsDto(
    int CurrentLevel,
    int LevelProgressPercentage,
    int LessonsAvailable,
    int ReviewsAvailable,
    int TotalLearned,
    int RadicalsLearned,
    int KanjiLearned,
    int VocabularyLearned,
    int TodayReviewsCount,
    double AccuracyRate,
    SrsDistributionDto SrsDistribution,
    List<SubjectSummaryDto> RecentSubjects
);

public record MeaningInputDto(string MeaningText, bool IsPrimary = true, string? AcceptedAlternatives = null);
public record ReadingInputDto(string ReadingText, ReadingType Type = ReadingType.Onyomi, bool IsPrimary = true, string? AcceptedAlternatives = null);
public record MnemonicInputDto(ReviewType Type, string Text, string? Hint = null);
public record ExampleSentenceInputDto(string Japanese, string English, string? Furigana = null);

public record CreateSubjectRequest(
    string Character,
    SubjectType Type,
    int Level,
    string? MeaningHint = null,
    string? ReadingHint = null,
    List<MeaningInputDto>? Meanings = null,
    List<ReadingInputDto>? Readings = null,
    List<MnemonicInputDto>? Mnemonics = null,
    List<ExampleSentenceInputDto>? ExampleSentences = null,
    List<string>? ComponentCharacters = null
);

public record UpdateSubjectRequest(
    string Character,
    SubjectType Type,
    int Level,
    string? MeaningHint = null,
    string? ReadingHint = null,
    List<MeaningInputDto>? Meanings = null,
    List<ReadingInputDto>? Readings = null,
    List<MnemonicInputDto>? Mnemonics = null,
    List<ExampleSentenceInputDto>? ExampleSentences = null,
    List<string>? ComponentCharacters = null
);

public record QuickGenerateSubjectRequest(string Character, SubjectType Type, int Level);

public record AdminLevelDistributionDto(int Level, int RadicalsCount, int KanjiCount, int VocabCount, int TotalCount);

public record AdminDeckStatsDto(
    int TotalSubjects,
    int TotalRadicals,
    int TotalKanji,
    int TotalVocabulary,
    int TotalLevels,
    int PendingAiCount,
    int TotalLearners,
    List<AdminLevelDistributionDto> LevelDistribution,
    List<SubjectSummaryDto> RecentSubjects
);

public record BulkActionResponse(bool Success, int Count, string Message);

public record AiGenerateRequest(SubjectType Type, string Character, int Level);
public record AiGenerateLevelRequest(
    int Level,
    string? Theme = null,
    int? RadicalCount = null,
    int? KanjiCount = null,
    int? VocabCount = null
);
public record AiBatchGenerateRequest(SubjectType Type, int Level, List<string> Characters);
public record AiEditContentRequest(string ParsedContentJson);
public record AiRefineContentRequest(string Instruction);
public record AiRejectRequest(string? Reason = null);

public record AiGenerateResponse(
    int Id,
    SubjectType Type,
    string Character,
    string Provider,
    string Model,
    AiContentStatus Status,
    string ParsedContentJson,
    string? ValidationErrors
);

// --- Progressive Curriculum Planning & Enrichment DTOs ---

public record CompactSubjectDto(string Character, SubjectType Type, int Level, string PrimaryMeaning, string? PrimaryReading);
public record CompactDependencyDto(string ParentCharacter, string ChildCharacter, DependencyType Type);

public record CurriculumContext(
    int CurrentLevel,
    List<string> KnownComponents,
    List<string> KnownKanji,
    List<string> KnownVocabulary,
    List<string> KnownReadings,
    List<CompactSubjectDto> RecentSubjects,
    List<string> RecentKanji,
    List<CompactDependencyDto> ExistingDependencies
);

public record LevelRequirements(
    int Level,
    int RadicalCount,
    int KanjiCount,
    int VocabCount,
    string? Theme = null
);

public record ProposedMeaningDto(string Meaning, bool IsPrimary = true, string? Alternatives = null);
public record ProposedReadingDto(string Reading, string Type, bool IsPrimary = true, string? Alternatives = null);

public record ProposedSubjectDto(
    SubjectType Type,
    string Character,
    int Level,
    int LessonPosition,
    List<string> ComponentCharacters,
    List<ProposedMeaningDto> Meanings,
    List<ProposedReadingDto> Readings
);

public record ProposedCurriculum(
    int Level,
    List<ProposedSubjectDto> Subjects
);

public record EnrichedSentenceDto(string Japanese, string English, string? Furigana = null);

public record EnrichedSubjectContentDto(
    string Character,
    SubjectType Type,
    string? MeaningHint,
    string? ReadingHint,
    string? MeaningMnemonic,
    string? ReadingMnemonic,
    List<EnrichedSentenceDto> ExampleSentences
);

public record EnrichedCurriculum(
    int Level,
    List<EnrichedSubjectContentDto> Enrichments
);

public record CurriculumValidationResult(
    bool IsValid,
    List<string> Errors,
    List<string> Warnings,
    List<ProposedSubjectDto> ValidSubjects,
    List<ProposedSubjectDto> InvalidSubjects
);

public record ResetLevelResult(
    bool Success,
    int Level,
    int DeletedSubjectsCount,
    int DeletedDependenciesCount,
    int DeletedSrsItemsCount,
    string Message
);

public record LevelGenerationResultDto(
    int Level,
    bool Success,
    string Message,
    int SubjectCount,
    int RadicalCount,
    int KanjiCount,
    int VocabCount,
    List<SubjectSummaryDto> Subjects,
    List<string> ValidationNotes
);

