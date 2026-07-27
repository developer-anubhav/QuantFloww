using System;
using System.Collections.Generic;

namespace QuantFloww.Application.DTOs
{
    public class WatchlistResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public List<WatchlistItemResponse> Items { get; set; } = new();
    }

    public class WatchlistItemResponse
    {
        public Guid Id { get; set; }
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Sector { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public decimal PrevClose { get; set; }
        public decimal Change { get; set; }
        public decimal ChangePercent { get; set; }
        public DateTime LastUpdated { get; set; }
    }

    public record CreateWatchlistRequest(string Name);

    public record AddWatchlistItemRequest(string Symbol);
}
