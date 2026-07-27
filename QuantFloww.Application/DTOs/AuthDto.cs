using System;

namespace QuantFloww.Application.DTOs
{
    public record RegisterRequest(string Email, string Username, string Password);

    public record LoginRequest(string Email, string Password);

    public record AuthResponse(string Token, string Username, string Email, DateTime Expiry);
}
