using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;
    private readonly ISrsService _srsService;

    public ReviewsController(IReviewService reviewService, ISrsService srsService)
    {
        _reviewService = reviewService;
        _srsService = srsService;
    }

    [HttpGet("queue")]
    public async Task<ActionResult<List<ReviewQueueItemDto>>> GetReviewQueue([FromQuery] int limit = 50)
    {
        if (User.IsInRole("Admin"))
            return Ok(new List<ReviewQueueItemDto>());

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out int userId))
            return Unauthorized();

        var queue = await _reviewService.GetReviewQueueAsync(userId, limit);
        return Ok(queue);
    }

    [HttpPost("submit")]
    public async Task<ActionResult<SubmitReviewResponse>> SubmitReview([FromBody] SubmitReviewRequest request)
    {
        if (User.IsInRole("Admin"))
            return BadRequest(new { message = "Admin account is configured for central deck management only." });

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out int userId))
            return Unauthorized();

        var response = await _srsService.ProcessReviewAsync(userId, request);
        return Ok(response);
    }

    [HttpGet("forecast")]
    public async Task<ActionResult<ReviewForecastDto>> GetReviewForecast()
    {
        if (User.IsInRole("Admin"))
            return Ok(new ReviewForecastDto(0, new List<HourlyForecastItem>(), new List<DailyForecastItem>()));

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out int userId))
            return Unauthorized();

        var forecast = await _reviewService.GetReviewForecastAsync(userId);
        return Ok(forecast);
    }
}
