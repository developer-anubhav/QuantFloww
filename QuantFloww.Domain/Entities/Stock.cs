using System;
using System.Collections.Generic;

namespace QuantFloww.Domain.Entities
{
    public class Stock
    {
        public string Symbol { get; set; } = string.Empty; // e.g., "RELIANCE", "TCS"
        public string Name { get; set; } = string.Empty;
        public string Exchange { get; set; } = string.Empty; // e.g., "NSE", "BSE"
        public string Sector { get; set; } = string.Empty; // e.g., "Technology", "Financial Services"
        
        public decimal Price { get; set; }
        public decimal PrevClose { get; set; }
        public decimal Open { get; set; }
        public decimal High { get; set; }
        public decimal Low { get; set; }
        public long Volume { get; set; }
        public decimal MarketCap { get; set; }
        public decimal? PeRatio { get; set; }
        public decimal? DividendYield { get; set; }
        
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        public virtual ICollection<StockPriceHistory> PriceHistory { get; set; } = new List<StockPriceHistory>();
    }
}
