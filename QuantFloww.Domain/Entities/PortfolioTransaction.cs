using System;

namespace QuantFloww.Domain.Entities
{
    public enum TransactionType
    {
        Buy,
        Sell
    }

    public class PortfolioTransaction
    {
        public Guid Id { get; set; }
        public Guid PortfolioId { get; set; }
        public virtual Portfolio? Portfolio { get; set; }
        public string StockSymbol { get; set; } = string.Empty;
        public TransactionType Type { get; set; }
        public int Quantity { get; set; }
        public decimal Price { get; set; }
        public DateTime ExecutedAt { get; set; }
    }
}
