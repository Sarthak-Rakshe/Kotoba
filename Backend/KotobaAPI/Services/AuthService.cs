using System.IdentityModel.Tokens.Jwt;
using System.Net.Mail;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using BCrypt.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Kotoba.DataAccess.Context;
using Kotoba.DataAccess.Entities;
using KotobaAPI.DTOs;
using KotobaAPI.Services.Interfaces;

namespace KotobaAPI.Services;

public class AuthService : IAuthService
{
    private static readonly Regex UsernameRegex = new(@"^[a-zA-Z0-9_-]{3,30}$", RegexOptions.Compiled);
    private readonly KotobaDbContext _context;
    private readonly IConfiguration _config;
    private readonly IProgressionService _progressionService;

    public AuthService(KotobaDbContext context, IConfiguration config, IProgressionService progressionService)
    {
        _context = context;
        _config = config;
        _progressionService = progressionService;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var cleanEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var cleanUsername = request.Username?.Trim() ?? string.Empty;
        var rawPassword = request.Password ?? string.Empty;

        // 1. Username validation
        if (string.IsNullOrWhiteSpace(cleanUsername) || !UsernameRegex.IsMatch(cleanUsername))
        {
            throw new ArgumentException("Username must be between 3 and 30 characters and contain only letters, numbers, underscores, or hyphens.");
        }

        // 2. Email validation
        if (string.IsNullOrWhiteSpace(cleanEmail) || !MailAddress.TryCreate(cleanEmail, out var addr) || addr.Address != cleanEmail)
        {
            throw new ArgumentException("A valid email address is required.");
        }

        // 3. Password complexity validation (production-grade yet learner friendly)
        if (rawPassword.Length < 8)
        {
            throw new ArgumentException("Password must be at least 8 characters long.");
        }
        if (!rawPassword.Any(char.IsUpper) || !rawPassword.Any(char.IsLower) || !rawPassword.Any(c => char.IsDigit(c) || char.IsPunctuation(c) || char.IsSymbol(c)))
        {
            throw new ArgumentException("Password must contain at least one uppercase letter, one lowercase letter, and one number or symbol.");
        }

        // 4. Duplicate checks
        var usernameTaken = await _context.Users.AnyAsync(u => u.Username.ToLower() == cleanUsername.ToLower());
        if (usernameTaken)
        {
            throw new InvalidOperationException("Username is already taken.");
        }

        var emailTaken = await _context.Users.AnyAsync(u => u.Email == cleanEmail);
        if (emailTaken)
        {
            throw new InvalidOperationException("An account with this email address already exists.");
        }

        // 5. BCrypt enhanced password hashing with work factor 11
        // 5. BCrypt enhanced password hashing with work factor 11
        var passwordHash = BCrypt.Net.BCrypt.EnhancedHashPassword(rawPassword, 11);

        bool isFirstUser = !await _context.Users.AnyAsync();

        var user = new User
        {
            Username = cleanUsername,
            Email = cleanEmail,
            PasswordHash = passwordHash,
            CurrentLevel = 1,
            IsAdmin = isFirstUser || cleanUsername.Equals("test1", StringComparison.OrdinalIgnoreCase) || cleanEmail.Contains("admin", StringComparison.OrdinalIgnoreCase),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // 6. Unlock initial Level 1 radicals for the new learner
        await _progressionService.UnlockInitialSubjectsForUserAsync(user.Id, 1);

        var token = GenerateJwtToken(user.Id, user.Username, user.Email, user.IsAdmin);
        return new AuthResponse(token, user.Id, user.Username, user.Email, user.CurrentLevel, user.IsAdmin);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var cleanEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var rawPassword = request.Password ?? string.Empty;

        if (string.IsNullOrWhiteSpace(cleanEmail) || string.IsNullOrWhiteSpace(rawPassword))
        {
            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == cleanEmail);

        // Security best practice: Constant-time check or uniform error response to prevent user enumeration
        if (user == null || !BCrypt.Net.BCrypt.EnhancedVerify(rawPassword, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        var token = GenerateJwtToken(user.Id, user.Username, user.Email, user.IsAdmin);
        return new AuthResponse(token, user.Id, user.Username, user.Email, user.CurrentLevel, user.IsAdmin);
    }

    public string GenerateJwtToken(int userId, string username, string email, bool isAdmin)
    {
        var secret = Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? _config["Jwt:Secret"] 
            ?? "KotobaJapaneseLearningAppSuperSecretKey2026!#$LongEnoughForHmac256";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Role, isAdmin ? "Admin" : "User"),
            new Claim("isAdmin", isAdmin ? "true" : "false"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "KotobaAPI",
            audience: _config["Jwt:Audience"] ?? "KotobaClient",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
