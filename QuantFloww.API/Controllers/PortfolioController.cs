using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuantFloww.Application.Persistence;
using QuantFloww.Domain.Entities;

namespace QuantFloww.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PortfolioController : ControllerBase
    {
        private readonly IPortfolioRepository _portfolioRepository;
        private readonly IStockRepository _stockRepository;

        public PortfolioController(IPortfolioRepository portfolioRepository, IStockRepository stockRepository)
        {
            _portfolioRepository = portfolioRepository;
            _stockRepository = stockRepository;
        }

        [HttpGet]
        public async Task<ActionResult<PortfolioResponse>> GetPortfolio()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var portfolio = await _portfolioRepository.GetByUserIdAsync(userId);
            if (portfolio == null)
            {
                // Auto-initialize starting portfolio with ₹10,00,000
                portfolio = new Portfolio
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Balance = 1000000.00m
                };
                await _portfolioRepository.AddAsync(portfolio);
                await _portfolioRepository.SaveChangesAsync();
            }

            return Ok(MapToPortfolioResponse(portfolio));
        }

        [HttpPost("trade")]
        public async Task<ActionResult<PortfolioResponse>> Trade([FromBody] TradeRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            if (request.Quantity <= 0)
                return BadRequest(new { Message = "Quantity must be greater than zero." });

            var stock = await _stockRepository.GetBySymbolAsync(request.StockSymbol);
            if (stock == null)
                return BadRequest(new { Message = "Stock symbol not found." });

            var portfolio = await _portfolioRepository.GetByUserIdAsync(userId);
            if (portfolio == null)
                return BadRequest(new { Message = "Portfolio not initialized." });

            bool isBuy = request.Type.Equals("BUY", StringComparison.OrdinalIgnoreCase);
            decimal totalValue = stock.Price * request.Quantity;

            if (isBuy)
            {
                if (portfolio.Balance < totalValue)
                    return BadRequest(new { Message = "Insufficient balance to execute buy order." });

                portfolio.Balance -= totalValue;

                var existingPosition = portfolio.Positions.FirstOrDefault(p => p.StockSymbol.Equals(stock.Symbol, StringComparison.OrdinalIgnoreCase));
                if (existingPosition != null)
                {
                    var totalShares = existingPosition.Quantity + request.Quantity;
                    var totalCost = (existingPosition.Quantity * existingPosition.AverageEntryPrice) + totalValue;
                    existingPosition.AverageEntryPrice = Math.Round(totalCost / totalShares, 2);
                    existingPosition.Quantity = totalShares;
                    existingPosition.LastUpdated = DateTime.UtcNow;
                }
                else
                {
                    var newPosition = new PortfolioPosition
                    {
                        Id = Guid.NewGuid(),
                        PortfolioId = portfolio.Id,
                        StockSymbol = stock.Symbol,
                        Quantity = request.Quantity,
                        AverageEntryPrice = stock.Price,
                        LastUpdated = DateTime.UtcNow
                    };
                    portfolio.Positions.Add(newPosition);
                }

                var transaction = new PortfolioTransaction
                {
                    Id = Guid.NewGuid(),
                    PortfolioId = portfolio.Id,
                    StockSymbol = stock.Symbol,
                    Type = TransactionType.Buy,
                    Quantity = request.Quantity,
                    Price = stock.Price,
                    ExecutedAt = DateTime.UtcNow
                };
                portfolio.Transactions.Add(transaction);
            }
            else
            {
                var existingPosition = portfolio.Positions.FirstOrDefault(p => p.StockSymbol.Equals(stock.Symbol, StringComparison.OrdinalIgnoreCase));
                if (existingPosition == null || existingPosition.Quantity < request.Quantity)
                    return BadRequest(new { Message = "Insufficient shares in holdings to execute sell order." });

                portfolio.Balance += totalValue;
                existingPosition.Quantity -= request.Quantity;
                existingPosition.LastUpdated = DateTime.UtcNow;

                if (existingPosition.Quantity == 0)
                {
                    portfolio.Positions.Remove(existingPosition);
                }

                var transaction = new PortfolioTransaction
                {
                    Id = Guid.NewGuid(),
                    PortfolioId = portfolio.Id,
                    StockSymbol = stock.Symbol,
                    Type = TransactionType.Sell,
                    Quantity = request.Quantity,
                    Price = stock.Price,
                    ExecutedAt = DateTime.UtcNow
                };
                portfolio.Transactions.Add(transaction);
            }

            await _portfolioRepository.SaveChangesAsync();
            return Ok(MapToPortfolioResponse(portfolio));
        }

        private static PortfolioResponse MapToPortfolioResponse(Portfolio portfolio)
        {
            return new PortfolioResponse
            {
                Id = portfolio.Id,
                UserId = portfolio.UserId,
                Balance = portfolio.Balance,
                Positions = portfolio.Positions.Select(p => new PositionResponse
                {
                    Id = p.Id,
                    StockSymbol = p.StockSymbol,
                    Quantity = p.Quantity,
                    AverageEntryPrice = p.AverageEntryPrice,
                    LastUpdated = p.LastUpdated
                }).ToList(),
                Transactions = portfolio.Transactions.Select(t => new TransactionResponse
                {
                    Id = t.Id,
                    StockSymbol = t.StockSymbol,
                    Type = t.Type.ToString().ToUpper(),
                    Quantity = t.Quantity,
                    Price = t.Price,
                    ExecutedAt = t.ExecutedAt
                }).OrderByDescending(t => t.ExecutedAt).ToList()
            };
        }
    }

    public class TradeRequest
    {
        public string StockSymbol { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // "BUY" or "SELL"
        public int Quantity { get; set; }
    }

    public class PortfolioResponse
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public decimal Balance { get; set; }
        public List<PositionResponse> Positions { get; set; } = new();
        public List<TransactionResponse> Transactions { get; set; } = new();
    }

    public class PositionResponse
    {
        public Guid Id { get; set; }
        public string StockSymbol { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal AverageEntryPrice { get; set; }
        public DateTime LastUpdated { get; set; }
    }

    public class TransactionResponse
    {
        public Guid Id { get; set; }
        public string StockSymbol { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // "BUY" or "SELL"
        public int Quantity { get; set; }
        public decimal Price { get; set; }
        public DateTime ExecutedAt { get; set; }
    }
}
