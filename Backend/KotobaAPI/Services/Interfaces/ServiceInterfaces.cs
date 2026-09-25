using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;

namespace KotobaAPI.Services.Interfaces;

public interface ISrsService
{
    DateTime? CalculateNextReviewTime(SrsStage stage);
    SrsStage CalculateNextStage(SrsStage currentStage, bool isCorrect, int incorrectCount = 0);
    Task<SubmitReviewResponse> ProcessReviewAsync(int userId, SubmitReviewRequest request);
}

public interface IProgressionService
{
    Task UnlockInitialSubjectsForUserAsync(int userId, int level = 1);
    Task<List<string>> CheckAndUnlockDependentSubjectsAsync(int userId, int completedSubjectId);
    Task<(bool LeveledUp, int NewLevel)> CheckLevelProgressionAsync(int userId);
}

public interface ILessonService
{
    Task<List<LessonItemDto>> GetAvailableLessonsAsync(int userId, int limit = 10);
    Task CompleteLessonAsync(int userId, int subjectId);
}

public interface IReviewService
{
    Task<List<ReviewQueueItemDto>> GetReviewQueueAsync(int userId, int limit = 50);
    Task<ReviewForecastDto> GetReviewForecastAsync(int userId);
}

public interface IDashboardService
{
    Task<DashboardStatsDto> GetDashboardStatsAsync(int userId);
    Task<AdminDeckStatsDto> GetAdminDeckStatsAsync();
}

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    string GenerateJwtToken(int userId, string username, string email, bool isAdmin);
}

public interface IAiContentGenerator
{
    Task<AiGenerateResponse> GenerateAndSaveContentAsync(AiGenerateRequest request);
    Task<List<AiGenerateResponse>> GenerateLevelBatchAsync(
        int level,
        string? theme = null,
        int? radicalCount = null,
        int? kanjiCount = null,
        int? vocabCount = null
    );
    Task<bool> ApproveContentAsync(int aiContentId);
    Task<int> ApproveAllPendingAsync(SubjectType? type = null);
    Task<bool> RejectContentAsync(int aiContentId, string? reason = null);
    Task<int> RejectAllPendingAsync(SubjectType? type = null, string? reason = null);
    Task<bool> UpdateContentAsync(int aiContentId, string updatedParsedJson);
    Task<AiGenerateResponse?> RefineContentAsync(int aiContentId, string instruction);
    Task<(bool Success, string Json, string? Error)> GenerateSingleRawJsonAsync(SubjectType type, string character, int level);
}

public interface ICurriculumContextService
{
    Task<CurriculumContext> BuildContextAsync(int currentLevel);
}

public interface ICurriculumValidationService
{
    CurriculumValidationResult ValidateProposedCurriculum(
        ProposedCurriculum proposal,
        CurriculumContext context,
        LevelRequirements requirements
    );
    bool IsValidJapaneseVocabulary(string text);
    bool IsValidReading(string reading);
    bool IsValidKanji(string character);
}

public interface ICurriculumPlannerService
{
    Task<ProposedCurriculum> GenerateLevelPlanAsync(
        int level,
        CurriculumContext context,
        LevelRequirements requirements
    );
    Task<List<ProposedSubjectDto>> RegenerateInvalidSubjectsAsync(
        int level,
        CurriculumContext context,
        List<ProposedSubjectDto> invalidSubjects,
        List<string> errors
    );
}

public interface IContentEnrichmentService
{
    Task<EnrichedCurriculum> EnrichSubjectsAsync(int level, IReadOnlyList<Kotoba.DataAccess.Entities.Subject> subjects);
}

public interface ICurriculumPipelineService
{
    Task<LevelGenerationResultDto> GenerateAndPublishLevelAsync(LevelRequirements requirements);
    Task<ResetLevelResult> ResetLevelAsync(int level);
}
