using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using QuantFloww.Domain.Entities;
using QuantFloww.Infrastructure.Identity;

namespace QuantFloww.Infrastructure.Persistence
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Stock> Stocks => Set<Stock>();
        public DbSet<StockPriceHistory> StockPriceHistories => Set<StockPriceHistory>();
        public DbSet<Watchlist> Watchlists => Set<Watchlist>();
        public DbSet<WatchlistItem> WatchlistItems => Set<WatchlistItem>();
        public DbSet<StockEvent> StockEvents => Set<StockEvent>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Stock
            modelBuilder.Entity<Stock>(entity =>
            {
                entity.HasKey(s => s.Symbol);
                entity.Property(s => s.Symbol).HasMaxLength(20);
                entity.Property(s => s.Name).IsRequired().HasMaxLength(150);
                entity.Property(s => s.Exchange).IsRequired().HasMaxLength(20);
                entity.Property(s => s.Sector).IsRequired().HasMaxLength(100);
                entity.Property(s => s.Price).HasPrecision(18, 4);
                entity.Property(s => s.PrevClose).HasPrecision(18, 4);
                entity.Property(s => s.Open).HasPrecision(18, 4);
                entity.Property(s => s.High).HasPrecision(18, 4);
                entity.Property(s => s.Low).HasPrecision(18, 4);
                entity.Property(s => s.MarketCap).HasPrecision(24, 4);
                entity.Property(s => s.PeRatio).HasPrecision(10, 4);
                entity.Property(s => s.DividendYield).HasPrecision(10, 4);
            });

            // Configure StockPriceHistory
            modelBuilder.Entity<StockPriceHistory>(entity =>
            {
                entity.HasKey(h => h.Id);
                entity.Property(h => h.Open).HasPrecision(18, 4);
                entity.Property(h => h.High).HasPrecision(18, 4);
                entity.Property(h => h.Low).HasPrecision(18, 4);
                entity.Property(h => h.Close).HasPrecision(18, 4);

                entity.HasOne(h => h.Stock)
                    .WithMany(s => s.PriceHistory)
                    .HasForeignKey(h => h.StockSymbol)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure Watchlist
            modelBuilder.Entity<Watchlist>(entity =>
            {
                entity.HasKey(w => w.Id);
                entity.Property(w => w.Name).IsRequired().HasMaxLength(100);
                entity.Property(w => w.UserId).IsRequired().HasMaxLength(450); // Matches default Identity user ID length
            });

            // Configure WatchlistItem
            modelBuilder.Entity<WatchlistItem>(entity =>
            {
                entity.HasKey(wi => wi.Id);

                entity.HasOne(wi => wi.Watchlist)
                    .WithMany(w => w.Items)
                    .HasForeignKey(wi => wi.WatchlistId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(wi => wi.Stock)
                    .WithMany()
                    .HasForeignKey(wi => wi.StockSymbol)
                    .OnDelete(DeleteBehavior.Cascade);

                // Add unique constraint for (WatchlistId, StockSymbol) to prevent duplicates
                entity.HasIndex(wi => new { wi.WatchlistId, wi.StockSymbol }).IsUnique();
            });

            // Configure StockEvent
            modelBuilder.Entity<StockEvent>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Title).IsRequired().HasMaxLength(150);
                entity.Property(e => e.Description).HasMaxLength(500);
                entity.Property(e => e.StockSymbol).IsRequired().HasMaxLength(20);

                entity.HasOne(e => e.Stock)
                    .WithMany(s => s.Events)
                    .HasForeignKey(e => e.StockSymbol)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
