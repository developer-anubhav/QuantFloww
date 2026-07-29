using System;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using QuantFloww.API.Middleware;
using QuantFloww.Infrastructure;
using QuantFloww.Infrastructure.Identity;
using QuantFloww.Infrastructure.Persistence;
using QuantFloww.Infrastructure.RealTime;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Swagger Gen config with JWT Support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "QuantFloww API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Configure Infrastructure services (Db, Identity, Repositories, Caching)
builder.Services.AddInfrastructure(builder.Configuration);

// Add SignalR
builder.Services.AddSignalR();

// JWT Authentication Configuration
var secret = builder.Configuration["JwtSettings:Secret"] ?? "QuantFlowwSuperSecretKeyForDevelopmentPhase1234567890!";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "QuantFlowwAPI",
        ValidAudience = builder.Configuration["JwtSettings:Audience"] ?? "QuantFlowwClient",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret))
    };

    // Support transmitting access tokens via query parameters for SignalR WebSockets
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/marketdata"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

// CORS Policy setup
var allowedOriginsSetting = builder.Configuration["CorsSettings:AllowedOrigins"];
Console.WriteLine($"[CORS CONFIG] CorsSettings:AllowedOrigins from configuration: '{allowedOriginsSetting}'");

var allowedOrigins = !string.IsNullOrEmpty(allowedOriginsSetting)
    ? allowedOriginsSetting.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    : new[] { "http://localhost:5173", "http://localhost:3000" };

foreach (var origin in allowedOrigins)
{
    Console.WriteLine($"[CORS CONFIG] Allowed Origin: '{origin}'");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .SetIsOriginAllowed(origin =>
              {
                  if (string.IsNullOrEmpty(origin)) return false;

                  // Allow localhost
                  if (origin.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase) || 
                      origin.Equals("http://localhost", StringComparison.OrdinalIgnoreCase))
                  {
                      return true;
                  }

                  // Allow any vercel.app subdomain
                  if (origin.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase))
                  {
                      return true;
                  }

                  // Check if it matches configured origins
                  return allowedOrigins.Any(o => origin.Equals(o, StringComparison.OrdinalIgnoreCase));
              })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Enable global exception handling middleware
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "QuantFloww API v1"));
}

app.UseCors("CorsPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<MarketDataHub>("/hubs/marketdata");

// Database initialization and seeding
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        
        logger.LogInformation("Initializing database migrations and seeding default stock assets...");
        await DatabaseSeeder.SeedAsync(context);
        logger.LogInformation("Database seeded successfully.");

        // Ensure standard Role exists
        if (!await roleManager.RoleExistsAsync("User"))
        {
            await roleManager.CreateAsync(new IdentityRole("User"));
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred during database seeding/migrations.");
    }
}

app.Run();
