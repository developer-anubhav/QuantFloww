using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QuantFloww.Application.Common.Interfaces;
using QuantFloww.Domain.Entities;
using QuantFloww.Infrastructure.Persistence;

namespace QuantFloww.Infrastructure.RealTime
{
    public class MockMarketDataBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<MarketDataHub> _hubContext;
        private readonly ICacheService _cacheService;
        private readonly ILogger<MockMarketDataBackgroundService> _logger;
        private List<Stock> _cachedStocks = new();
        private readonly Random _random = new();

        private static readonly List<Stock> _newStocksToRegister = new();
        private static readonly object _lock = new();

        public static void RegisterNewStock(Stock stock)
        {
            lock (_lock)
            {
                _newStocksToRegister.Add(stock);
            }
        }

        public MockMarketDataBackgroundService(
            IServiceScopeFactory scopeFactory,
            IHubContext<MarketDataHub> hubContext,
            ICacheService cacheService,
            ILogger<MockMarketDataBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
            _cacheService = cacheService;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Mock Market Data Background Service is starting.");

            // Wait a moment for seeding to complete if it is running at the same time
            await Task.Delay(5000, stoppingToken);

            // Load initial stocks list from database
            using (var scope = _scopeFactory.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                try
                {
                    _cachedStocks = dbContext.Stocks.ToList();
                    _logger.LogInformation("Loaded {Count} stocks for live simulation.", _cachedStocks.Count);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error loading stocks for simulation. Will retry in next loop.");
                }
            }

            var dbUpdateCounter = 0;

            while (!stoppingToken.IsCancellationRequested)
            {
                // Register dynamically added stocks from search
                lock (_lock)
                {
                    if (_newStocksToRegister.Any())
                    {
                        foreach (var newStock in _newStocksToRegister)
                        {
                            if (!_cachedStocks.Any(s => s.Symbol == newStock.Symbol))
                            {
                                _cachedStocks.Add(newStock);
                            }
                        }
                        _newStocksToRegister.Clear();
                    }
                }

                if (!_cachedStocks.Any())
                {
                    // Reload if empty
                    try
                    {
                        using (var scope = _scopeFactory.CreateScope())
                        {
                            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                            _cachedStocks = dbContext.Stocks.ToList();
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to reload stocks. Retrying in next cycle.");
                    }
                    await Task.Delay(5000, stoppingToken);
                    continue;
                }

                foreach (var stock in _cachedStocks)
                {
                    // Random fluctuation: between -0.15% and +0.15% per tick
                    double percentage = _random.NextDouble() * 0.003 - 0.0015;
                    decimal priceChange = stock.Price * (decimal)percentage;
                    
                    decimal oldPrice = stock.Price;
                    stock.Price = Math.Round(stock.Price + priceChange, 2);
                    stock.High = Math.Max(stock.High, stock.Price);
                    stock.Low = Math.Min(stock.Low, stock.Price);
                    stock.Volume += _random.Next(50, 500);
                    stock.LastUpdated = DateTime.UtcNow;

                    decimal change = stock.Price - stock.PrevClose;
                    decimal changePercent = stock.PrevClose > 0 ? (change / stock.PrevClose) * 100 : 0;

                    var updatePayload = new
                    {
                        Symbol = stock.Symbol,
                        Price = stock.Price,
                        Open = stock.Open,
                        High = stock.High,
                        Low = stock.Low,
                        Volume = stock.Volume,
                        Change = Math.Round(change, 2),
                        ChangePercent = Math.Round(changePercent, 2),
                        LastUpdated = stock.LastUpdated
                    };

                    // Update Cache
                    await _cacheService.SetAsync($"stock:{stock.Symbol}", updatePayload, TimeSpan.FromMinutes(5));

                    // Broadcast globally
                    await _hubContext.Clients.All.SendAsync("ReceivePriceUpdate", updatePayload, cancellationToken: stoppingToken);

                    // Broadcast to specific symbol groups
                    await _hubContext.Clients.Group(stock.Symbol).SendAsync("ReceiveTickerUpdate", updatePayload, cancellationToken: stoppingToken);
                }

                // Simulate block deals: ~10% chance per tick (~20 seconds average)
                if (_random.NextDouble() < 0.10 && _cachedStocks.Any())
                {
                    var stock = _cachedStocks[_random.Next(_cachedStocks.Count)];
                    var quantity = _random.Next(20, 150) * 1000;
                    var tradeValue = stock.Price * quantity;
                    var buyers = new[] { "LIC of India", "HDFC Mutual Fund", "SBI Mutual Fund", "Morgan Stanley", "Societe Generale", "ICICI Prudential" };
                    var sellers = new[] { "Promoter Group", "FII Sector Fund", "Vanguard Group", "Norway Government Pension Fund", "BlackRock ETF" };

                    var buyer = buyers[_random.Next(buyers.Length)];
                    var seller = sellers[_random.Next(sellers.Length)];
                    while (seller == buyer)
                    {
                        seller = sellers[_random.Next(sellers.Length)];
                    }

                    var blockDealPayload = new
                    {
                        Id = Guid.NewGuid(),
                        Symbol = stock.Symbol,
                        Price = Math.Round(stock.Price, 2),
                        Quantity = quantity,
                        ValueCr = Math.Round(tradeValue / 10000000.0m, 2), // in Indian Crores
                        Buyer = buyer,
                        Seller = seller,
                        Time = DateTime.UtcNow
                    };

                    await _hubContext.Clients.All.SendAsync("ReceiveBlockDeal", blockDealPayload, cancellationToken: stoppingToken);
                }

                dbUpdateCounter++;

                // Every 15 ticks (~30 seconds), batch update database state
                if (dbUpdateCounter >= 15)
                {
                    dbUpdateCounter = 0;
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                        foreach (var cachedStock in _cachedStocks)
                        {
                            var dbStock = dbContext.Stocks.FirstOrDefault(s => s.Symbol == cachedStock.Symbol);
                            if (dbStock != null)
                            {
                                dbStock.Price = cachedStock.Price;
                                dbStock.High = cachedStock.High;
                                dbStock.Low = cachedStock.Low;
                                dbStock.Volume = cachedStock.Volume;
                                dbStock.LastUpdated = cachedStock.LastUpdated;
                            }
                        }
                        try
                        {
                            await dbContext.SaveChangesAsync(stoppingToken);
                            _logger.LogDebug("Successfully saved simulated stock prices to database.");
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to save simulated stock prices to database.");
                        }
                    }
                }

                // Simulate tick interval (2 seconds)
                await Task.Delay(2000, stoppingToken);
            }

            _logger.LogInformation("Mock Market Data Background Service is stopping.");
        }
    }
}
