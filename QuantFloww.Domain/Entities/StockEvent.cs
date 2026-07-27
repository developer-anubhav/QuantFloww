using System;

namespace QuantFloww.Domain.Entities
{
    public enum StockEventType
    {
        Dividend,
        Earnings,
        Split,
        BoardMeeting
    }

    public class StockEvent
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string StockSymbol { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public StockEventType Type { get; set; }

        // Navigation property
        public Stock? Stock { get; set; }
    }
}
