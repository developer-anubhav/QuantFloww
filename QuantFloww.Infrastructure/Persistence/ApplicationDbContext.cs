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
        public DbSet<Portfolio> Portfolios => Set<Portfolio>();
        public DbSet<PortfolioPosition> PortfolioPositions => Set<PortfolioPosition>();
        public DbSet<PortfolioTransaction> PortfolioTransactions => Set<PortfolioTransaction>();

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

            // Configure Portfolio
            modelBuilder.Entity<Portfolio>(entity =>
            {
                entity.HasKey(p => p.Id);
                entity.Property(p => p.UserId).IsRequired().HasMaxLength(450);
                entity.HasIndex(p => p.UserId).IsUnique();
                entity.Property(p => p.Balance).HasPrecision(18, 4);
            });

            // Configure PortfolioPosition
            modelBuilder.Entity<PortfolioPosition>(entity =>
            {
                entity.HasKey(pp => pp.Id);
                entity.Property(pp => pp.StockSymbol).IsRequired().HasMaxLength(20);
                entity.Property(pp => pp.AverageEntryPrice).HasPrecision(18, 4);

                entity.HasOne(pp => pp.Portfolio)
                    .WithMany(p => p.Positions)
                    .HasForeignKey(pp => pp.PortfolioId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(pp => new { pp.PortfolioId, pp.StockSymbol }).IsUnique();
            });

            // Configure PortfolioTransaction
            modelBuilder.Entity<PortfolioTransaction>(entity =>
            {
                entity.HasKey(pt => pt.Id);
                entity.Property(pt => pt.StockSymbol).IsRequired().HasMaxLength(20);
                entity.Property(pt => pt.Price).HasPrecision(18, 4);

                entity.HasOne(pt => pt.Portfolio)
                    .WithMany(p => p.Transactions)
                    .HasForeignKey(pt => pt.PortfolioId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
