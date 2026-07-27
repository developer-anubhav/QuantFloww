using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuantFloww.Application.Common.Interfaces;
using QuantFloww.Application.DTOs;
using QuantFloww.Application.Persistence;
using QuantFloww.Domain.Entities;

namespace QuantFloww.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class WatchlistsController : ControllerBase
    {
        private readonly IWatchlistRepository _watchlistRepository;
        private readonly IStockRepository _stockRepository;
        private readonly ICacheService _cacheService;

        public WatchlistsController(
            IWatchlistRepository watchlistRepository, 
            IStockRepository stockRepository, 
            ICacheService cacheService)
        {
            _watchlistRepository = watchlistRepository;
            _stockRepository = stockRepository;
            _cacheService = cacheService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<WatchlistResponse>>> GetWatchlists()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var watchlists = await _watchlistRepository.GetByUserIdAsync(userId);
            var response = new List<WatchlistResponse>();

            foreach (var wl in watchlists)
            {
                response.Add(await MapToWatchlistResponse(wl));
            }

            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<WatchlistResponse>> GetWatchlistById(Guid id)
        {
            var watchlist = await _watchlistRepository.GetByIdAsync(id);
            if (watchlist == null)
                return NotFound(new { Message = "Watchlist not found." });

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (watchlist.UserId != userId)
                return Forbid();

            var response = await MapToWatchlistResponse(watchlist);
            return Ok(response);
        }

        [HttpPost]
        public async Task<ActionResult<WatchlistResponse>> Create([FromBody] CreateWatchlistRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { Message = "Watchlist name cannot be empty." });

            var watchlist = new Watchlist
            {
                Name = request.Name,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            await _watchlistRepository.AddAsync(watchlist);
            await _watchlistRepository.SaveChangesAsync();

            var response = await MapToWatchlistResponse(watchlist);
            return CreatedAtAction(nameof(GetWatchlistById), new { id = watchlist.Id }, response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var watchlist = await _watchlistRepository.GetByIdAsync(id);
            if (watchlist == null)
                return NotFound(new { Message = "Watchlist not found." });

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (watchlist.UserId != userId)
                return Forbid();

            await _watchlistRepository.DeleteAsync(watchlist);
            await _watchlistRepository.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("{id}/items")]
        public async Task<ActionResult<WatchlistResponse>> AddItem(Guid id, [FromBody] AddWatchlistItemRequest request)
        {
            var watchlist = await _watchlistRepository.GetByIdAsync(id);
            if (watchlist == null)
                return NotFound(new { Message = "Watchlist not found." });

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (watchlist.UserId != userId)
                return Forbid();

            var stock = await _stockRepository.GetBySymbolAsync(request.Symbol.ToUpper());
            if (stock == null)
                return BadRequest(new { Message = $"Stock symbol {request.Symbol} does not exist." });

            // Check if item already exists
            if (watchlist.Items.Any(i => i.StockSymbol.Equals(request.Symbol, StringComparison.OrdinalIgnoreCase)))
            {
                return BadRequest(new { Message = "Stock is already in this watchlist." });
            }

            var item = new WatchlistItem
            {
                WatchlistId = id,
                StockSymbol = stock.Symbol,
                AddedAt = DateTime.UtcNow
            };

            watchlist.Items.Add(item);
            await _watchlistRepository.SaveChangesAsync();

            // Reload watchlist to get updated list
            var updatedWatchlist = await _watchlistRepository.GetByIdAsync(id);
            var response = await MapToWatchlistResponse(updatedWatchlist!);
            return Ok(response);
        }

        [HttpDelete("{id}/items/{symbol}")]
        public async Task<ActionResult<WatchlistResponse>> RemoveItem(Guid id, string symbol)
        {
            var watchlist = await _watchlistRepository.GetByIdAsync(id);
            if (watchlist == null)
                return NotFound(new { Message = "Watchlist not found." });

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (watchlist.UserId != userId)
                return Forbid();

            var item = watchlist.Items.FirstOrDefault(i => i.StockSymbol.Equals(symbol, StringComparison.OrdinalIgnoreCase));
            if (item == null)
                return NotFound(new { Message = "Stock is not in this watchlist." });

            watchlist.Items.Remove(item);
            await _watchlistRepository.SaveChangesAsync();

            // Reload watchlist
            var updatedWatchlist = await _watchlistRepository.GetByIdAsync(id);
            var response = await MapToWatchlistResponse(updatedWatchlist!);
            return Ok(response);
        }

        private async Task<WatchlistResponse> MapToWatchlistResponse(Watchlist wl)
        {
            var items = new List<WatchlistItemResponse>();

            foreach (var item in wl.Items)
            {
                if (item.Stock == null) continue;

                var stock = item.Stock;
                var cachedUpdate = await _cacheService.GetAsync<dynamic>($"stock:{stock.Symbol}");

                decimal price = stock.Price;
                DateTime lastUpdated = stock.LastUpdated;

                if (cachedUpdate != null)
                {
                    try
                    {
                        var element = (JsonElement)cachedUpdate;
                        price = element.GetProperty("price").GetDecimal();
                        lastUpdated = element.GetProperty("lastUpdated").GetDateTime();
                    }
                    catch { }
                }

                decimal change = price - stock.PrevClose;
                decimal changePercent = stock.PrevClose > 0 ? (change / stock.PrevClose) * 100 : 0;

                items.Add(new WatchlistItemResponse
                {
                    Id = item.Id,
                    Symbol = stock.Symbol,
                    Name = stock.Name,
                    Sector = stock.Sector,
                    Price = price,
                    PrevClose = stock.PrevClose,
                    Change = Math.Round(change, 2),
                    ChangePercent = Math.Round(changePercent, 2),
                    LastUpdated = lastUpdated
                });
            }

            return new WatchlistResponse
            {
                Id = wl.Id,
                Name = wl.Name,
                UserId = wl.UserId,
                CreatedAt = wl.CreatedAt,
                Items = items
            };
        }
    }
}
