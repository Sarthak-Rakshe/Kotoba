using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Kotoba.DataAccess.Context;
using Kotoba.DataAccess.Data;
using KotobaAPI.Middleware;
using KotobaAPI.Services;
using KotobaAPI.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Controllers & JSON configuration
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// OpenAPI
builder.Services.AddOpenApi();

// Database Context (PostgreSQL with dotnet User Secrets / appsettings / env var support)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? builder.Configuration["DB_CONNECTION_STRING"] 
    ?? "Host=localhost;Database=kotoba_db;Username=postgres;Password=sarthak;Port=5432";

builder.Services.AddDbContext<KotobaDbContext>(options =>
{
    options.UseNpgsql(connectionString);
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.MultipleCollectionIncludeWarning));
});

// Authentication & JWT (with dotnet User Secrets / appsettings / env var support)
var jwtSecret = builder.Configuration["Jwt:Secret"] 
    ?? builder.Configuration["JWT_SECRET"] 
    ?? "KotobaJapaneseLearningAppSuperSecretKey2026!#$LongEnoughForHmac256";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "KotobaAPI",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "KotobaClient",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });

builder.Services.AddAuthorization();

// Rate Limiting on Auth endpoints (prevent brute-force password attacks)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("AuthPolicy", opt =>
    {
        opt.PermitLimit = 20;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
});

// CORS
builder.Services.AddCors(options =>
{
    var allowedOriginsEnv = builder.Configuration["ALLOWED_ORIGINS"] ?? builder.Configuration["Cors:AllowedOrigins"];
    var extraOrigins = string.IsNullOrWhiteSpace(allowedOriginsEnv)
        ? Array.Empty<string>()
        : allowedOriginsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrEmpty(origin)) return false;
            try
            {
                var uri = new Uri(origin);
                return uri.Host == "localhost"
                    || uri.Host == "127.0.0.1"
                    || uri.Host.EndsWith(".pages.dev", StringComparison.OrdinalIgnoreCase)
                    || extraOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

// Application Services
builder.Services.AddHttpClient();
builder.Services.AddSingleton<ISystemLogService, SystemLogService>();
builder.Services.AddScoped<IProgressionService, ProgressionService>();
builder.Services.AddScoped<ISrsService, SrsService>();
builder.Services.AddScoped<ILessonService, LessonService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAiContentGenerator, GeminiContentGenerator>();
builder.Services.AddScoped<ICurriculumContextService, CurriculumContextService>();
builder.Services.AddScoped<ICurriculumValidationService, CurriculumValidationService>();
builder.Services.AddScoped<ICurriculumPlannerService, CurriculumPlannerService>();
builder.Services.AddScoped<IContentEnrichmentService, ContentEnrichmentService>();
builder.Services.AddScoped<ICurriculumPipelineService, CurriculumPipelineService>();

var app = builder.Build();

// Useful, High-Signal HTTP Request Logging Middleware (Console + In-Memory Audit Trail)
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? "";
    // Avoid self-referencing feedback loops from logs polling, health checks, or non-API routes
    if (!path.StartsWith("/api") 
        || path.StartsWith("/api/admin/logs", StringComparison.OrdinalIgnoreCase) 
        || path.EndsWith("/health", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    var method = context.Request.Method;
    var query = context.Request.QueryString.HasValue ? context.Request.QueryString.Value : "";
    var endpointWithParams = $"{path}{query}";
    var sw = Stopwatch.StartNew();
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    var systemLog = context.RequestServices.GetRequiredService<ISystemLogService>();

    try
    {
        await next();
        sw.Stop();
        var status = context.Response.StatusCode;
        var user = context.User.Identity?.IsAuthenticated == true 
            ? $"{context.User.Identity.Name ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier)}{(context.User.IsInRole("Admin") ? " [Admin]" : "")}" 
            : "Anonymous";

        var category = path.Contains("/ai") ? "AI" 
            : path.Contains("/auth") ? "AUTH" 
            : path.Contains("/subjects") ? "DECK" 
            : path.Contains("/lessons") ? "LESSONS" 
            : path.Contains("/reviews") ? "REVIEWS" 
            : "HTTP";

        if (status >= 400)
        {
            logger.LogWarning("[{StatusCode}] {Method} {Endpoint} | {Elapsed}ms | User: {User}", status, method, endpointWithParams, sw.ElapsedMilliseconds, user);
            systemLog.LogWarning(category, $"{method} {endpointWithParams} responded with HTTP {status}", endpointWithParams, method, status, sw.ElapsedMilliseconds, user);
        }
        else
        {
            logger.LogInformation("[{StatusCode}] {Method} {Endpoint} | {Elapsed}ms | User: {User}", status, method, endpointWithParams, sw.ElapsedMilliseconds, user);
            systemLog.LogInfo(category, $"{method} {endpointWithParams} completed", endpointWithParams, method, status, sw.ElapsedMilliseconds, user);
        }
    }
    catch (Exception ex)
    {
        sw.Stop();
        logger.LogError(ex, "[FAIL] {Method} {Endpoint} | {Elapsed}ms", method, endpointWithParams, sw.ElapsedMilliseconds);
        systemLog.LogError("HTTP", $"{method} {endpointWithParams} failed with unhandled exception", ex, endpointWithParams, method, 500, sw.ElapsedMilliseconds);
        throw;
    }
});

// Auto seed if database connection succeeds
try
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<KotobaDbContext>();
    if (!connectionString.Contains("YOUR_POSTGRES_PASSWORD_HERE"))
    {
        await DbInitializer.SeedAsync(dbContext);
        app.Logger.LogInformation("Database initialized and ready.");
    }
}
catch (Exception ex)
{
    app.Logger.LogWarning("Database initialization note: {Message}", ex.Message);
}

// Exception middleware
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Configure HTTP pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health & Status check endpoints (for Docker, uptime pingers, and browser inspection)
app.MapGet("/", () => Results.Ok(new
{
    status = "Healthy",
    service = "Kotoba API",
    timestamp = DateTime.UtcNow
}));

app.MapGet("/health", async (KotobaDbContext db) =>
{
    bool dbConnected = false;
    try
    {
        dbConnected = await db.Database.CanConnectAsync();
    }
    catch
    {
        dbConnected = false;
    }

    return Results.Ok(new
    {
        status = dbConnected ? "Healthy" : "Degraded",
        database = dbConnected ? "Connected" : "Disconnected",
        timestamp = DateTime.UtcNow
    });
});

app.MapGet("/api/health", async (KotobaDbContext db) =>
{
    bool dbConnected = false;
    try
    {
        dbConnected = await db.Database.CanConnectAsync();
    }
    catch
    {
        dbConnected = false;
    }

    return Results.Ok(new
    {
        status = dbConnected ? "Healthy" : "Degraded",
        database = dbConnected ? "Connected" : "Disconnected",
        timestamp = DateTime.UtcNow
    });
});

app.Run();
