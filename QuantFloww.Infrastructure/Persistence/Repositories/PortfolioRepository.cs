using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using QuantFloww.Application.Persistence;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Infrastructure.Persistence.Repositories
{
    public class PortfolioRepository : IPortfolioRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public PortfolioRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<Portfolio?> GetByUserIdAsync(string userId)
        {
            return await _dbContext.Portfolios
                .Include(p => p.Positions)
                .Include(p => p.Transactions)
                .FirstOrDefaultAsync(p => p.UserId == userId);
        }

        public async Task AddAsync(Portfolio portfolio)
        {
            await _dbContext.Portfolios.AddAsync(portfolio);
        }

        public async Task SaveChangesAsync()
        {
            await _dbContext.SaveChangesAsync();
        }
    }
}
