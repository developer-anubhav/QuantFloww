using System;
using System.Collections.Generic;

namespace QuantFloww.Domain.Entities
{
    public class Portfolio
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public decimal Balance { get; set; } = 1000000.00m; // Default starting cash: ₹10,00,000
        public virtual ICollection<PortfolioPosition> Positions { get; set; } = new List<PortfolioPosition>();
        public virtual ICollection<PortfolioTransaction> Transactions { get; set; } = new List<PortfolioTransaction>();
    }
}
