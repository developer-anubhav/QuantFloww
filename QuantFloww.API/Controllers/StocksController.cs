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

namespace QuantFloww.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StocksController : ControllerBase
    {
        private readonly IStockRepository _stockRepository;
        private readonly ICacheService _cacheService;

        public StocksController(IStockRepository stockRepository, ICacheService cacheService)
        {
            _stockRepository = stockRepository;
            _cacheService = cacheService;
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
            var stocks = await _stockRepository.SearchAsync(query);
            var responses = new List<StockResponse>();

            foreach (var stock in stocks)
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
            var cachedUpdate = await _cacheService.GetAsync<dynamic>($"stock:{stock.Symbol}");

            decimal price = stock.Price;
            decimal open = stock.Open;
            decimal high = stock.High;
            decimal low = stock.Low;
            long volume = stock.Volume;
            DateTime lastUpdated = stock.LastUpdated;

            if (cachedUpdate != null)
            {
                try
                {
                    var element = (JsonElement)cachedUpdate;
                    price = element.GetProperty("price").GetDecimal();
                    open = element.GetProperty("open").GetDecimal();
                    high = element.GetProperty("high").GetDecimal();
                    low = element.GetProperty("low").GetDecimal();
                    volume = element.GetProperty("volume").GetInt64();
                    lastUpdated = element.GetProperty("lastUpdated").GetDateTime();
                }
                catch
                {
                    // Fallback to DB properties if JSON parse fails
                }
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
