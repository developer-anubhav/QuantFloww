using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using QuantFloww.Application.Common.Interfaces;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Infrastructure.Services
{
    public class YahooFinanceService : IYahooFinanceService
    {
        public async Task<IEnumerable<StockSearchSuggestion>> SearchSuggestionsAsync(string query)
        {
            var suggestions = new List<StockSearchSuggestion>();
            if (string.IsNullOrWhiteSpace(query)) return suggestions;

            try
            {
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                var url = $"https://query2.finance.yahoo.com/v1/finance/search?q={Uri.EscapeDataString(query)}";
                var response = await httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return suggestions;

                var jsonString = await response.Content.ReadAsStringAsync();
                var root = JsonNode.Parse(jsonString);
                var quotes = root?["quotes"]?.AsArray();
                if (quotes == null) return suggestions;

                foreach (var quote in quotes)
                {
                    if (quote == null) continue;

                    var symbol = quote["symbol"]?.ToString() ?? string.Empty;
                    var name = quote["shortname"]?.ToString() ?? quote["longname"]?.ToString() ?? string.Empty;
                    var exchange = quote["exchDisp"]?.ToString() ?? string.Empty;

                    // Filter only NSE & BSE Indian stocks
                    bool isIndian = exchange.Equals("NSE", StringComparison.OrdinalIgnoreCase) || 
                                    exchange.Equals("BSE", StringComparison.OrdinalIgnoreCase) || 
                                    symbol.EndsWith(".NS", StringComparison.OrdinalIgnoreCase) || 
                                    symbol.EndsWith(".BO", StringComparison.OrdinalIgnoreCase);

                    if (isIndian)
                    {
                        // Clean up exchange display
                        string cleanExch = exchange.Equals("BSE", StringComparison.OrdinalIgnoreCase) || symbol.EndsWith(".BO", StringComparison.OrdinalIgnoreCase) 
                            ? "BSE" 
                            : "NSE";

                        // Infer sector from company name keywords
                        string sector = InferSector(name);

                        suggestions.Add(new StockSearchSuggestion
                        {
                            Symbol = symbol,
                            Name = name,
                            Exchange = cleanExch,
                            Sector = sector
                        });
                    }
                }
            }
            catch
            {
                // Return whatever suggestions we gathered so far or empty
            }

            return suggestions;
        }

        public async Task<(List<StockPriceHistory> History, Stock Stock)?> FetchStockDataAsync(string symbol, string name, string sector)
        {
            try
            {
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=90d&interval=1d";
                var response = await httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return null;

                var jsonString = await response.Content.ReadAsStringAsync();
                var root = JsonNode.Parse(jsonString);
                var resultNode = root?["chart"]?["result"]?[0];
                if (resultNode == null) return null;

                var metaNode = resultNode["meta"];
                var timestamps = resultNode["timestamp"]?.AsArray();
                var quoteNode = resultNode["indicators"]?["quote"]?[0];
                if (timestamps == null || quoteNode == null) return null;

                var opens = quoteNode["open"]?.AsArray();
                var highs = quoteNode["high"]?.AsArray();
                var lows = quoteNode["low"]?.AsArray();
                var closes = quoteNode["close"]?.AsArray();
                var volumes = quoteNode["volume"]?.AsArray();

                // Clean the symbol to store in database (e.g. "TATAMOTORS" instead of "TATAMOTORS.NS")
                string cleanSymbol = symbol;
                if (symbol.Contains("."))
                {
                    cleanSymbol = symbol.Split('.')[0];
                }

                var histories = new List<StockPriceHistory>();
                for (int i = 0; i < timestamps.Count; i++)
                {
                    if (opens[i] == null || highs[i] == null || lows[i] == null || closes[i] == null)
                    {
                        continue;
                    }

                    var timestamp = (long)timestamps[i]!;
                    var date = DateTimeOffset.FromUnixTimeSeconds(timestamp).UtcDateTime.Date;

                    histories.Add(new StockPriceHistory
                    {
                        StockSymbol = cleanSymbol,
                        Date = date,
                        Open = Math.Round((decimal)opens[i]!, 2),
                        High = Math.Round((decimal)highs[i]!, 2),
                        Low = Math.Round((decimal)lows[i]!, 2),
                        Close = Math.Round((decimal)closes[i]!, 2),
                        Volume = volumes?[i] != null ? (long)volumes[i]! : 0
                    });
                }

                if (!histories.Any()) return null;

                var lastHistory = histories.Last();
                var prevClose = histories.Count > 1 ? histories[histories.Count - 2].Close : lastHistory.Open;
                string cleanExch = symbol.EndsWith(".BO", StringComparison.OrdinalIgnoreCase) ? "BSE" : "NSE";

                var stock = new Stock
                {
                    Symbol = cleanSymbol,
                    Name = name,
                    Exchange = cleanExch,
                    Sector = sector,
                    Price = lastHistory.Close,
                    PrevClose = prevClose,
                    Open = lastHistory.Open,
                    High = lastHistory.High,
                    Low = lastHistory.Low,
                    Volume = lastHistory.Volume,
                    MarketCap = metaNode?["marketCap"] != null ? (decimal)metaNode["marketCap"]! : 150000000000.0m,
                    PeRatio = metaNode?["trailingPE"] != null ? (decimal)metaNode["trailingPE"]! : 20.0m,
                    DividendYield = metaNode?["dividendYield"] != null ? (decimal)metaNode["dividendYield"]! : 1.0m,
                    LastUpdated = DateTime.UtcNow
                };

                return (histories, stock);
            }
            catch
            {
                return null;
            }
        }

        private string InferSector(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "Indian Equity";

            var lower = name.ToLower();
            if (lower.Contains("bank")) return "Financial Services";
            if (lower.Contains("finance") || lower.Contains("insurance") || lower.Contains("investment")) return "Financial Services";
            if (lower.Contains("technology") || lower.Contains("software") || lower.Contains("consultancy") || lower.Contains("computer") || lower.Contains("tech") || lower.Contains("infosys")) return "Technology";
            if (lower.Contains("motor") || lower.Contains("auto") || lower.Contains("car") || lower.Contains("tyre")) return "Automotive";
            if (lower.Contains("power") || lower.Contains("energy") || lower.Contains("petro") || lower.Contains("oil") || lower.Contains("gas")) return "Energy";
            if (lower.Contains("steel") || lower.Contains("metal") || lower.Contains("iron") || lower.Contains("mining")) return "Basic Materials";
            if (lower.Contains("pharma") || lower.Contains("health") || lower.Contains("lab") || lower.Contains("drug")) return "Healthcare";
            if (lower.Contains("cement") || lower.Contains("build") || lower.Contains("infra") || lower.Contains("construction")) return "Industrials";
            if (lower.Contains("telecom") || lower.Contains("communication")) return "Telecommunications";

            return "Indian Equity";
        }
    }
}
