using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using QuantFloww.Application.Common.Interfaces;
using QuantFloww.Application.DTOs;
using QuantFloww.Infrastructure.Identity;

namespace QuantFloww.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IJwtTokenGenerator _jwtTokenGenerator;

        public AuthController(UserManager<ApplicationUser> userManager, IJwtTokenGenerator jwtTokenGenerator)
        {
            _userManager = userManager;
            _jwtTokenGenerator = jwtTokenGenerator;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = new ApplicationUser
            {
                UserName = request.Username,
                Email = request.Email
            };

            var result = await _userManager.CreateAsync(user, request.Password);

            if (!result.Succeeded)
            {
                var errors = result.Errors.Select(e => e.Description);
                return BadRequest(new { Errors = errors });
            }

            // Assign a default "User" role
            await _userManager.AddToRoleAsync(user, "User");

            var token = _jwtTokenGenerator.GenerateToken(user.Id, user.Email!, user.UserName!, new[] { "User" });
            return Ok(new AuthResponse(token, user.UserName!, user.Email!, DateTime.UtcNow.AddDays(1)));
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null || !await _userManager.CheckPasswordAsync(user, request.Password))
            {
                return Unauthorized(new { Message = "Invalid email or password." });
            }

            var roles = await _userManager.GetRolesAsync(user);
            var token = _jwtTokenGenerator.GenerateToken(user.Id, user.Email!, user.UserName!, roles);

            return Ok(new AuthResponse(token, user.UserName!, user.Email!, DateTime.UtcNow.AddDays(1)));
        }

        [HttpPost("google-login")]
        public async Task<IActionResult> GoogleLogin([FromBody] string googleToken)
        {
            // Simple mockup Google authentication for development testing
            // In production, you would verify the Google JWT token using GoogleJsonWebSignature.ValidateAsync()
            
            var mockEmail = "google_user@quantfloww.com";
            var mockUsername = "google_user";

            var user = await _userManager.FindByEmailAsync(mockEmail);
            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = mockUsername,
                    Email = mockEmail,
                    EmailConfirmed = true
                };

                // Create user without password since they use OAuth
                var result = await _userManager.CreateAsync(user);
                if (result.Succeeded)
                {
                    await _userManager.AddToRoleAsync(user, "User");
                }
                else
                {
                    return BadRequest(new { Message = "Failed to create user from Google profile." });
                }
            }

            var roles = await _userManager.GetRolesAsync(user);
            var token = _jwtTokenGenerator.GenerateToken(user.Id, user.Email!, user.UserName!, roles);

            return Ok(new AuthResponse(token, user.UserName!, user.Email!, DateTime.UtcNow.AddDays(1)));
        }

        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return NotFound(new { Message = "User not found." });

            return Ok(new
            {
                Id = user.Id,
                Username = user.UserName,
                Email = user.Email
            });
        }
    }
}
