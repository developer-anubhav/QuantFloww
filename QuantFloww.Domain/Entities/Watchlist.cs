using System;
using System.Collections.Generic;

namespace QuantFloww.Domain.Entities
{
    public class Watchlist
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty; // Reference to Identity User (string ID)
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<WatchlistItem> Items { get; set; } = new List<WatchlistItem>();
    }
}
