using System;
using System.Threading.Tasks;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Application.Persistence
{
    public interface IPortfolioRepository
    {
        Task<Portfolio?> GetByUserIdAsync(string userId);
        Task AddAsync(Portfolio portfolio);
        Task SaveChangesAsync();
    }
}
