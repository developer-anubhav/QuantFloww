using System;

namespace QuantFloww.Domain.Entities
{
    public class StockPriceHistory
    {
        public int Id { get; set; }
        public string StockSymbol { get; set; } = string.Empty;
        public virtual Stock? Stock { get; set; }
        
        public DateTime Date { get; set; }
        public decimal Open { get; set; }
        public decimal High { get; set; }
        public decimal Low { get; set; }
        public decimal Close { get; set; }
        public long Volume { get; set; }
    }
}
