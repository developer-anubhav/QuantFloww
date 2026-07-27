using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using QuantFloww.Application.Common.Interfaces;
using QuantFloww.Application.Persistence;
using QuantFloww.Infrastructure.Caching;
using QuantFloww.Infrastructure.Identity;
using QuantFloww.Infrastructure.Persistence;
using QuantFloww.Infrastructure.Persistence.Repositories;
using QuantFloww.Infrastructure.RealTime;
using QuantFloww.Infrastructure.Security;
using QuantFloww.Infrastructure.Services;

namespace QuantFloww.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            // Database connection
            var connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? "Server=(localdb)\\MSSQLLocalDB;Database=QuantFlowwDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(connectionString));

            // Identity Configurations
            services.AddIdentity<ApplicationUser, IdentityRole>(options =>
            {
                options.Password.RequireDigit = false;
                options.Password.RequiredLength = 6;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireLowercase = false;
                options.User.RequireUniqueEmail = true;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

            // Repositories
            services.AddScoped<IStockRepository, StockRepository>();
            services.AddScoped<IWatchlistRepository, WatchlistRepository>();
            services.AddScoped<IYahooFinanceService, YahooFinanceService>();

            // Caching & JWT Utilities
            services.AddMemoryCache();
            services.AddSingleton<ICacheService, CacheService>();
            services.AddSingleton<IJwtTokenGenerator, JwtTokenGenerator>();

            // Live Simulator Background Task
            services.AddHostedService<MockMarketDataBackgroundService>();

            return services;
        }
    }
}
