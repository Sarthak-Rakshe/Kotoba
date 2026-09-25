using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Context;
using Kotoba.Utility.Enums;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly IAiContentGenerator _aiGenerator;
    private readonly ICurriculumPipelineService _pipelineService;
    private readonly KotobaDbContext _context;

    public AiController(
        IAiContentGenerator aiGenerator,
        ICurriculumPipelineService pipelineService,
        KotobaDbContext context)
    {
        _aiGenerator = aiGenerator;
        _pipelineService = pipelineService;
        _context = context;
    }

    [HttpPost("generate")]
    public async Task<ActionResult<AiGenerateResponse>> Generate([FromBody] AiGenerateRequest request)
    {
        var result = await _aiGenerator.GenerateAndSaveContentAsync(request);
        return Ok(result);
    }

    [HttpPost("generate-level")]
    public async Task<ActionResult<LevelGenerationResultDto>> GenerateLevel([FromBody] AiGenerateLevelRequest request)
    {
        var requirements = new LevelRequirements(
            Level: request.Level,
            RadicalCount: request.RadicalCount ?? 10,
            KanjiCount: request.KanjiCount ?? 14,
            VocabCount: request.VocabCount ?? 16,
            Theme: request.Theme
        );

        var result = await _pipelineService.GenerateAndPublishLevelAsync(requirements);
        return Ok(result);
    }

    [HttpPost("reset-level/{level:int}")]
    public async Task<ActionResult<ResetLevelResult>> ResetLevel(int level)
    {
        var result = await _pipelineService.ResetLevelAsync(level);
        return Ok(result);
    }

    [HttpGet("pending")]
    public async Task<ActionResult> GetPending()
    {
        var pending = await _context.AiGeneratedContents
            .Where(a => a.Status == AiContentStatus.Pending || a.Status == AiContentStatus.NeedsReview)
            .OrderByDescending(a => a.CreatedAt)
            .Take(100)
            .ToListAsync();

        return Ok(pending);
    }

    [HttpPost("approve/{id:int}")]
    public async Task<ActionResult> Approve(int id)
    {
        var success = await _aiGenerator.ApproveContentAsync(id);
        if (!success)
            return BadRequest(new { success = false, message = "Could not approve content or already approved." });

        return Ok(new { success = true, message = "Content approved and added to central curriculum." });
    }

    [HttpPost("approve-all")]
    public async Task<ActionResult<BulkActionResponse>> ApproveAll([FromQuery] SubjectType? type = null)
    {
        var count = await _aiGenerator.ApproveAllPendingAsync(type);
        return Ok(new BulkActionResponse(
            Success: true,
            Count: count,
            Message: $"Successfully approved {count} subjects into the central curriculum."
        ));
    }

    [HttpPost("reject/{id:int}")]
    public async Task<ActionResult> Reject(int id, [FromBody] AiRejectRequest? request)
    {
        var success = await _aiGenerator.RejectContentAsync(id, request?.Reason);
        if (!success)
            return NotFound(new { success = false, message = "Content not found." });

        return Ok(new { success = true, message = "Content rejected." });
    }

    [HttpPost("reject-all")]
    public async Task<ActionResult<BulkActionResponse>> RejectAll([FromQuery] SubjectType? type = null, [FromBody] AiRejectRequest? request = null)
    {
        var count = await _aiGenerator.RejectAllPendingAsync(type, request?.Reason);
        return Ok(new BulkActionResponse(
            Success: true,
            Count: count,
            Message: $"Successfully rejected {count} subjects."
        ));
    }

    [HttpPut("edit/{id:int}")]
    public async Task<ActionResult> Edit(int id, [FromBody] AiEditContentRequest request)
    {
        var success = await _aiGenerator.UpdateContentAsync(id, request.ParsedContentJson);
        if (!success)
            return BadRequest(new { success = false, message = "Invalid JSON or content not found." });

        return Ok(new { success = true, message = "Content updated successfully." });
    }

    [HttpPost("refine/{id:int}")]
    public async Task<ActionResult<AiGenerateResponse>> Refine(int id, [FromBody] AiRefineContentRequest request)
    {
        var updated = await _aiGenerator.RefineContentAsync(id, request.Instruction);
        if (updated == null)
            return NotFound(new { success = false, message = "Content not found." });

        return Ok(updated);
    }
}
