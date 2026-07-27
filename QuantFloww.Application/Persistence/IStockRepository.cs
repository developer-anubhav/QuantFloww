using System.Collections.Generic;
using System.Threading.Tasks;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Application.Persistence
{
    public interface IStockRepository
    {
        Task<Stock?> GetBySymbolAsync(string symbol);
        Task<IEnumerable<Stock>> SearchAsync(string query);
        Task<IEnumerable<Stock>> GetAllAsync();
        Task<IEnumerable<StockPriceHistory>> GetPriceHistoryAsync(string symbol, int days);
        Task<IEnumerable<StockEvent>> GetEventsAsync(string symbol);
        Task AddAsync(Stock stock);
        Task AddRangeAsync(IEnumerable<Stock> stocks);
        Task AddPriceHistoryRangeAsync(IEnumerable<StockPriceHistory> history);
        Task UpdateAsync(Stock stock);
        Task SaveChangesAsync();
    }
}
