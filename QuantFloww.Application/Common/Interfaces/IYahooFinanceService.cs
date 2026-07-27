using System.Collections.Generic;
using System.Threading.Tasks;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Application.Common.Interfaces
{
    public class StockSearchSuggestion
    {
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Exchange { get; set; } = string.Empty;
        public string Sector { get; set; } = string.Empty;
    }

    public interface IYahooFinanceService
    {
        Task<IEnumerable<StockSearchSuggestion>> SearchSuggestionsAsync(string query);
        Task<(List<StockPriceHistory> History, Stock Stock)?> FetchStockDataAsync(string symbol, string name, string sector);
    }
}
