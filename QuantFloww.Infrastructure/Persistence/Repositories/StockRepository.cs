using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using QuantFloww.Application.Persistence;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Infrastructure.Persistence.Repositories
{
    public class StockRepository : IStockRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public StockRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<Stock?> GetBySymbolAsync(string symbol)
        {
            return await _dbContext.Stocks
                .Include(s => s.PriceHistory)
                .FirstOrDefaultAsync(s => s.Symbol == symbol);
        }

        public async Task<IEnumerable<Stock>> SearchAsync(string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return await _dbContext.Stocks.Take(10).ToListAsync();
            }

            var lowerQuery = query.ToLower();
            return await _dbContext.Stocks
                .Where(s => s.Symbol.ToLower().Contains(lowerQuery) || s.Name.ToLower().Contains(lowerQuery))
                .Take(20)
                .ToListAsync();
        }

        public async Task<IEnumerable<Stock>> GetAllAsync()
        {
            return await _dbContext.Stocks.ToListAsync();
        }

        public async Task<IEnumerable<StockPriceHistory>> GetPriceHistoryAsync(string symbol, int days)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-days);
            return await _dbContext.StockPriceHistories
                .Where(h => h.StockSymbol == symbol && h.Date >= cutoffDate)
                .OrderBy(h => h.Date)
                .ToListAsync();
        }

        public async Task AddAsync(Stock stock)
        {
            await _dbContext.Stocks.AddAsync(stock);
        }

        public async Task AddRangeAsync(IEnumerable<Stock> stocks)
        {
            await _dbContext.Stocks.AddRangeAsync(stocks);
        }

        public async Task AddPriceHistoryRangeAsync(IEnumerable<StockPriceHistory> history)
        {
            await _dbContext.StockPriceHistories.AddRangeAsync(history);
        }

        public async Task UpdateAsync(Stock stock)
        {
            _dbContext.Stocks.Update(stock);
            await Task.CompletedTask;
        }

        public async Task SaveChangesAsync()
        {
            await _dbContext.SaveChangesAsync();
        }
    }
}
