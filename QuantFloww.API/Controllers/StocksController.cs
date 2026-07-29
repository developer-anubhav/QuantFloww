using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using QuantFloww.Application.Common.Interfaces;
using QuantFloww.Application.DTOs;
using QuantFloww.Application.Persistence;
using System.Text.Json;
using QuantFloww.Domain.Entities;
using QuantFloww.Infrastructure.RealTime;

namespace QuantFloww.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StocksController : ControllerBase
    {
        private readonly IStockRepository _stockRepository;
        private readonly ICacheService _cacheService;
        private readonly IYahooFinanceService _yahooFinanceService;

        public StocksController(IStockRepository stockRepository, ICacheService cacheService, IYahooFinanceService yahooFinanceService)
        {
            _stockRepository = stockRepository;
            _cacheService = cacheService;
            _yahooFinanceService = yahooFinanceService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<StockResponse>>> GetAll()
        {
            var stocks = await _stockRepository.GetAllAsync();
            var responses = new List<StockResponse>();

            foreach (var stock in stocks)
            {
                responses.Add(await MapToStockResponse(stock));
            }

            return Ok(responses);
        }

        [HttpGet("{symbol}")]
        public async Task<ActionResult<StockResponse>> GetBySymbol(string symbol)
        {
            var stock = await _stockRepository.GetBySymbolAsync(symbol.ToUpper());
            if (stock == null)
            {
                return NotFound(new { Message = $"Stock with symbol {symbol} not found." });
            }

            var response = await MapToStockResponse(stock);
            return Ok(response);
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<StockResponse>>> Search([FromQuery] string query = "")
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                var allStocks = await _stockRepository.GetAllAsync();
                var allResponses = new List<StockResponse>();
                foreach (var stock in allStocks)
                {
                    allResponses.Add(await MapToStockResponse(stock));
                }
                return Ok(allResponses);
            }

            // 1. Search locally in our database first
            var localStocks = await _stockRepository.SearchAsync(query);
            var resultsMap = localStocks.ToDictionary(s => s.Symbol.ToUpper(), s => s);

            // 2. Search Yahoo Finance Suggestions to discover any new Indian ticker
            try
            {
                var suggestions = await _yahooFinanceService.SearchSuggestionsAsync(query);
                foreach (var sugg in suggestions)
                {
                    string cleanSymbol = sugg.Symbol;
                    if (sugg.Symbol.Contains("."))
                    {
                        cleanSymbol = sugg.Symbol.Split('.')[0];
                    }
                    cleanSymbol = cleanSymbol.ToUpper();

                    // If it is already loaded locally, skip
                    if (resultsMap.ContainsKey(cleanSymbol)) continue;

                    // Check if it already exists in the database but just wasn't in the search results
                    var existingDbStock = await _stockRepository.GetBySymbolAsync(cleanSymbol);
                    if (existingDbStock != null)
                    {
                        resultsMap[cleanSymbol] = existingDbStock;
                        continue;
                    }

                    // Dynamically fetch and seed this new Indian stock!
                    var fetched = await _yahooFinanceService.FetchStockDataAsync(sugg.Symbol, sugg.Name, sugg.Sector);
                    if (fetched != null)
                    {
                        var (history, stock) = fetched.Value;

                        // Save the stock and its history to the database
                        await _stockRepository.AddAsync(stock);
                        await _stockRepository.AddPriceHistoryRangeAsync(history);
                        await _stockRepository.SaveChangesAsync();

                        // Register with the background simulator so it ticks dynamically in real-time
                        MockMarketDataBackgroundService.RegisterNewStock(stock);

                        resultsMap[cleanSymbol] = stock;
                    }
                }
            }
            catch
            {
                // Gracefully fallback to whatever we loaded locally
            }

            // Map and return all results
            var responses = new List<StockResponse>();
            foreach (var stock in resultsMap.Values)
            {
                responses.Add(await MapToStockResponse(stock));
            }

            return Ok(responses);
        }

        [HttpGet("{symbol}/history")]
        public async Task<ActionResult<IEnumerable<StockHistoryResponse>>> GetHistory(string symbol, [FromQuery] int days = 30)
        {
            var history = await _stockRepository.GetPriceHistoryAsync(symbol.ToUpper(), days);
            var response = history.Select(h => new StockHistoryResponse
            {
                Date = h.Date.ToString("yyyy-MM-dd"),
                Open = h.Open,
                High = h.High,
                Low = h.Low,
                Close = h.Close,
                Volume = h.Volume
            }).ToList();

            return Ok(response);
        }

        [HttpGet("{symbol}/events")]
        public async Task<ActionResult<IEnumerable<dynamic>>> GetEvents(string symbol)
        {
            var events = await _stockRepository.GetEventsAsync(symbol.ToUpper());
            var response = events.Select(e => new
            {
                Id = e.Id,
                StockSymbol = e.StockSymbol,
                Date = e.Date.ToString("yyyy-MM-dd"),
                Title = e.Title,
                Description = e.Description,
                Type = e.Type.ToString()
            }).ToList();

            return Ok(response);
        }

        private async Task<StockResponse> MapToStockResponse(Stock stock)
        {
            // Check cache for simulated live price updates
            var cachedUpdate = await _cacheService.GetAsync<StockPriceCachePayload>($"stock:{stock.Symbol}");

            decimal price = stock.Price;
            decimal open = stock.Open;
            decimal high = stock.High;
            decimal low = stock.Low;
            long volume = stock.Volume;
            DateTime lastUpdated = stock.LastUpdated;

            if (cachedUpdate != null)
            {
                price = cachedUpdate.Price;
                open = cachedUpdate.Open;
                high = cachedUpdate.High;
                low = cachedUpdate.Low;
                volume = cachedUpdate.Volume;
                lastUpdated = cachedUpdate.LastUpdated;
            }

            decimal change = price - stock.PrevClose;
            decimal changePercent = stock.PrevClose > 0 ? (change / stock.PrevClose) * 100 : 0;

            return new StockResponse
            {
                Symbol = stock.Symbol,
                Name = stock.Name,
                Sector = stock.Sector,
                Exchange = stock.Exchange,
                Price = price,
                PrevClose = stock.PrevClose,
                Open = open,
                High = high,
                Low = low,
                Volume = volume,
                MarketCap = stock.MarketCap,
                PeRatio = stock.PeRatio,
                DividendYield = stock.DividendYield,
                Change = Math.Round(change, 2),
                ChangePercent = Math.Round(changePercent, 2),
                LastUpdated = lastUpdated
            };
        }
    }
}
