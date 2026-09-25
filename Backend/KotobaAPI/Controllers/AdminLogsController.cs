using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/admin/logs")]
public class AdminLogsController : ControllerBase
{
    private readonly ISystemLogService _logService;

    public AdminLogsController(ISystemLogService logService)
    {
        _logService = logService;
    }

    [HttpGet]
    public ActionResult<IReadOnlyList<SystemLogEntry>> GetLogs(
        [FromQuery] int limit = 100,
        [FromQuery] string? level = null,
        [FromQuery] string? category = null,
        [FromQuery] string? search = null)
    {
        var logs = _logService.GetRecentLogs(limit, level, category, search);
        return Ok(logs);
    }

    [HttpPost("clear")]
    public ActionResult ClearLogs()
    {
        _logService.Clear();
        return Ok(new { success = true, message = "Logs cleared successfully." });
    }
}
