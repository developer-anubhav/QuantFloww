using System;

namespace QuantFloww.Application.DTOs
{
    public class StockResponse
    {
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Sector { get; set; } = string.Empty;
        public string Exchange { get; set; } = string.Empty;
        
        public decimal Price { get; set; }
        public decimal PrevClose { get; set; }
        public decimal Open { get; set; }
        public decimal High { get; set; }
        public decimal Low { get; set; }
        public long Volume { get; set; }
        public decimal MarketCap { get; set; }
        public decimal? PeRatio { get; set; }
        public decimal? DividendYield { get; set; }
        
        public decimal Change { get; set; }
        public decimal ChangePercent { get; set; }
        public DateTime LastUpdated { get; set; }
    }

    public class StockHistoryResponse
    {
        public string Date { get; set; } = string.Empty; // formatted string e.g. "2026-07-27"
        public decimal Open { get; set; }
        public decimal High { get; set; }
        public decimal Low { get; set; }
        public decimal Close { get; set; }
        public long Volume { get; set; }
    }
}
