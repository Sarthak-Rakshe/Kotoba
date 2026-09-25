using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class LessonsController : ControllerBase
{
    private readonly ILessonService _lessonService;

    public LessonsController(ILessonService lessonService)
    {
        _lessonService = lessonService;
    }

    [HttpGet("available")]
    public async Task<ActionResult<List<LessonItemDto>>> GetAvailableLessons([FromQuery] int limit = 10)
    {
        if (User.IsInRole("Admin"))
            return Ok(new List<LessonItemDto>());

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out int userId))
            return Unauthorized();

        var lessons = await _lessonService.GetAvailableLessonsAsync(userId, limit);
        return Ok(lessons);
    }

    [HttpPost("{id:int}/complete")]
    public async Task<ActionResult> CompleteLesson(int id)
    {
        if (User.IsInRole("Admin"))
            return BadRequest(new { success = false, message = "Admin account is configured for central deck management only." });

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out int userId))
            return Unauthorized();

        await _lessonService.CompleteLessonAsync(userId, id);
        return Ok(new { success = true, message = "Lesson completed successfully." });
    }
}
