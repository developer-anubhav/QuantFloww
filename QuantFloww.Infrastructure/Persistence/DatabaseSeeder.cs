using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using QuantFloww.Domain.Entities;

namespace QuantFloww.Infrastructure.Persistence
{
    public static class DatabaseSeeder
    {
        public static async Task SeedAsync(ApplicationDbContext context)
        {
            // Apply migrations and create database if it doesn't exist
            await context.Database.MigrateAsync();

            if (await context.Stocks.AnyAsync())
            {
                return; // Database already seeded
            }

            var stockDefinitions = new[]
            {
                new { Symbol = "RELIANCE", YahooSymbol = "RELIANCE.NS", Name = "Reliance Industries Ltd.", Sector = "Energy", BasePrice = 1350.0m },
                new { Symbol = "TCS", YahooSymbol = "TCS.NS", Name = "Tata Consultancy Services Ltd.", Sector = "Technology", BasePrice = 4100.0m },
                new { Symbol = "HDFCBANK", YahooSymbol = "HDFCBANK.NS", Name = "HDFC Bank Ltd.", Sector = "Financial Services", BasePrice = 1680.0m },
                new { Symbol = "INFY", YahooSymbol = "INFY.NS", Name = "Infosys Ltd.", Sector = "Technology", BasePrice = 1850.0m },
                new { Symbol = "ICICIBANK", YahooSymbol = "ICICIBANK.NS", Name = "ICICI Bank Ltd.", Sector = "Financial Services", BasePrice = 1200.0m }
            };

            var stocks = new List<Stock>();
            var histories = new List<StockPriceHistory>();

            foreach (var def in stockDefinitions)
            {
                // Attempt to fetch real stock quotes and 90 days history from Yahoo Finance
                var liveData = await FetchFromYahooAsync(def.Symbol, def.YahooSymbol, def.Name, def.Sector);
                if (liveData != null)
                {
                    stocks.Add(liveData.Value.Stock);
                    histories.AddRange(liveData.Value.History);
                    Console.WriteLine($"Successfully seeded {def.Symbol} with live Yahoo Finance data.");
                }
                else
                {
                    // Fallback: Generate mock deterministic prices if offline or rate-limited
                    Console.WriteLine($"Fallback triggered: Generating mock seed data for {def.Symbol}.");
                    var random = new Random(def.Symbol.GetHashCode());

                    var stock = new Stock
                    {
                        Symbol = def.Symbol,
                        Name = def.Name,
                        Exchange = "NSE",
                        Sector = def.Sector,
                        MarketCap = def.BasePrice * random.Next(10000000, 50000000),
                        PeRatio = (decimal)(random.NextDouble() * 15 + 15),
                        DividendYield = (decimal)(random.NextDouble() * 1.5 + 0.5),
                        LastUpdated = DateTime.UtcNow
                    };

                    decimal currentPrice = def.BasePrice;
                    var startDate = DateTime.UtcNow.AddDays(-90).Date;
                    var endDate = DateTime.UtcNow.Date;

                    StockPriceHistory? lastHistory = null;

                    for (var date = startDate; date <= endDate; date = date.AddDays(1))
                    {
                        if (date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday)
                        {
                            continue;
                        }

                        decimal dailyReturn = (decimal)(random.NextDouble() * 0.02 - 0.009); // slight upward walk
                        decimal close = currentPrice * (1.0m + dailyReturn);
                        decimal open = currentPrice * (1.0m + (decimal)(random.NextDouble() * 0.004 - 0.002));
                        decimal high = Math.Max(open, close) * (1.0m + (decimal)(random.NextDouble() * 0.01));
                        decimal low = Math.Min(open, close) * (1.0m - (decimal)(random.NextDouble() * 0.01));
                        long volume = random.Next(500000, 3000000);

                        close = Math.Max(close, 1.0m);
                        open = Math.Max(open, 1.0m);
                        high = Math.Max(high, 1.0m);
                        low = Math.Max(low, 1.0m);

                        var history = new StockPriceHistory
                        {
                            StockSymbol = def.Symbol,
                            Date = date,
                            Open = Math.Round(open, 2),
                            High = Math.Round(high, 2),
                            Low = Math.Round(low, 2),
                            Close = Math.Round(close, 2),
                            Volume = volume
                        };

                        histories.Add(history);
                        currentPrice = close;
                        lastHistory = history;
                    }

                    if (lastHistory != null)
                    {
                        stock.Price = lastHistory.Close;
                        stock.PrevClose = lastHistory.Open;
                        stock.Open = lastHistory.Open;
                        stock.High = lastHistory.High;
                        stock.Low = lastHistory.Low;
                        stock.Volume = lastHistory.Volume;
                    }
                    else
                    {
                        stock.Price = def.BasePrice;
                        stock.Open = def.BasePrice;
                        stock.High = def.BasePrice;
                        stock.Low = def.BasePrice;
                    }

                    stocks.Add(stock);
                }
            }

            var events = new List<StockEvent>();
            foreach (var stock in stocks)
            {
                events.Add(new StockEvent
                {
                    StockSymbol = stock.Symbol,
                    Date = DateTime.UtcNow.AddDays(-15),
                    Title = "Q4 Financial Results",
                    Description = $"{stock.Name} announced its Q4 audited financial results showing an increase in net margin.",
                    Type = StockEventType.Earnings
                });

                events.Add(new StockEvent
                {
                    StockSymbol = stock.Symbol,
                    Date = DateTime.UtcNow.AddDays(5),
                    Title = "Annual General Meeting (AGM)",
                    Description = $"The board of directors of {stock.Name} will hold its annual general meeting to discuss future strategy.",
                    Type = StockEventType.BoardMeeting
                });

                events.Add(new StockEvent
                {
                    StockSymbol = stock.Symbol,
                    Date = DateTime.UtcNow.AddDays(18),
                    Title = "Interim Dividend Distribution",
                    Description = $"{stock.Name} announced an interim dividend of ₹{(stock.Price * 0.012m):F2} per equity share.",
                    Type = StockEventType.Dividend
                });
            }

            await context.Stocks.AddRangeAsync(stocks);
            await context.StockPriceHistories.AddRangeAsync(histories);
            await context.StockEvents.AddRangeAsync(events);
            await context.SaveChangesAsync();
        }

        private static async Task<(List<StockPriceHistory> History, Stock Stock)?> FetchFromYahooAsync(
            string symbol, string yahooSymbol, string name, string sector)
        {
            try
            {
                using var httpClient = new HttpClient();
                // Set User-Agent to avoid HTTP 403 Forbidden from Yahoo endpoints
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                
                var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{yahooSymbol}?range=90d&interval=1d";
                var response = await httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }

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
                        StockSymbol = symbol,
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

                var stock = new Stock
                {
                    Symbol = symbol,
                    Name = name,
                    Exchange = "NSE",
                    Sector = sector,
                    Price = lastHistory.Close,
                    PrevClose = prevClose,
                    Open = lastHistory.Open,
                    High = lastHistory.High,
                    Low = lastHistory.Low,
                    Volume = lastHistory.Volume,
                    MarketCap = metaNode?["marketCap"] != null ? (decimal)metaNode["marketCap"]! : 1200000000000.0m,
                    PeRatio = metaNode?["trailingPE"] != null ? (decimal)metaNode["trailingPE"]! : 22.5m,
                    DividendYield = metaNode?["dividendYield"] != null ? (decimal)metaNode["dividendYield"]! : 1.2m,
                    LastUpdated = DateTime.UtcNow
                };

                return (histories, stock);
            }
            catch
            {
                return null;
            }
        }
    }
}
