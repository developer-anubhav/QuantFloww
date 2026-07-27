using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using QuantFloww.Application.Persistence;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Infrastructure.Persistence.Repositories
{
    public class WatchlistRepository : IWatchlistRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public WatchlistRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<Watchlist?> GetByIdAsync(Guid id)
        {
            return await _dbContext.Watchlists
                .Include(w => w.Items)
                    .ThenInclude(wi => wi.Stock)
                .FirstOrDefaultAsync(w => w.Id == id);
        }

        public async Task<IEnumerable<Watchlist>> GetByUserIdAsync(string userId)
        {
            return await _dbContext.Watchlists
                .Include(w => w.Items)
                    .ThenInclude(wi => wi.Stock)
                .Where(w => w.UserId == userId)
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();
        }

        public async Task AddAsync(Watchlist watchlist)
        {
            await _dbContext.Watchlists.AddAsync(watchlist);
        }

        public async Task AddItemAsync(WatchlistItem item)
        {
            await _dbContext.WatchlistItems.AddAsync(item);
        }

        public async Task UpdateAsync(Watchlist watchlist)
        {
            _dbContext.Watchlists.Update(watchlist);
            await Task.CompletedTask;
        }

        public async Task DeleteAsync(Watchlist watchlist)
        {
            _dbContext.Watchlists.Remove(watchlist);
            await Task.CompletedTask;
        }

        public async Task SaveChangesAsync()
        {
            await _dbContext.SaveChangesAsync();
        }
    }
}
