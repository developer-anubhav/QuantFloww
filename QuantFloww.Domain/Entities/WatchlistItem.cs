using System;

namespace QuantFloww.Domain.Entities
{
    public class WatchlistItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        public Guid WatchlistId { get; set; }
        public virtual Watchlist? Watchlist { get; set; }
        
        public string StockSymbol { get; set; } = string.Empty;
        public virtual Stock? Stock { get; set; }
        
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    }
}
