using System;

namespace QuantFloww.Domain.Entities
{
    public class PortfolioPosition
    {
        public Guid Id { get; set; }
        public Guid PortfolioId { get; set; }
        public virtual Portfolio? Portfolio { get; set; }
        public string StockSymbol { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal AverageEntryPrice { get; set; }
        public DateTime LastUpdated { get; set; }
    }
}
