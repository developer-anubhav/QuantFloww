using System.Collections.Generic;
using System.Security.Claims;

namespace QuantFloww.Application.Common.Interfaces
{
    public interface IJwtTokenGenerator
    {
        string GenerateToken(string userId, string email, string username, IEnumerable<string> roles);
    }
}
