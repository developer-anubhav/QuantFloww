using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Application.Persistence
{
    public interface IWatchlistRepository
    {
        Task<Watchlist?> GetByIdAsync(Guid id);
        Task<IEnumerable<Watchlist>> GetByUserIdAsync(string userId);
        Task AddAsync(Watchlist watchlist);
        Task AddItemAsync(WatchlistItem item);
        Task UpdateAsync(Watchlist watchlist);
        Task DeleteAsync(Watchlist watchlist);
        Task SaveChangesAsync();
    }
}
