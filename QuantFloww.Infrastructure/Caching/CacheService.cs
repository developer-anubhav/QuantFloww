using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using QuantFloww.Application.Common.Interfaces;

namespace QuantFloww.Infrastructure.Caching
{
    public class CacheService : ICacheService
    {
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<CacheService> _logger;
        private readonly IDatabase? _redisDatabase;
        private readonly bool _useRedis;

        public CacheService(
            IMemoryCache memoryCache, 
            IConfiguration configuration, 
            ILogger<CacheService> logger)
        {
            _memoryCache = memoryCache;
            _logger = logger;

            var redisConnectionString = configuration.GetConnectionString("Redis");
            if (!string.IsNullOrWhiteSpace(redisConnectionString))
            {
                try
                {
                    // Set a quick connection timeout so it doesn't block startup long
                    var options = ConfigurationOptions.Parse(redisConnectionString);
                    options.ConnectTimeout = 2000; 
                    options.AbortOnConnectFail = false;

                    var connection = ConnectionMultiplexer.Connect(options);
                    if (connection.IsConnected)
                    {
                        _redisDatabase = connection.GetDatabase();
                        _useRedis = true;
                        _logger.LogInformation("Successfully connected to Redis cache.");
                    }
                    else
                    {
                        _logger.LogWarning("Redis connection configured but failed to connect. Falling back to In-Memory cache.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Redis connection failed with error. Falling back to In-Memory cache.");
                }
            }
            else
            {
                _logger.LogInformation("Redis connection string not configured. Using In-Memory cache.");
            }
        }

        public async Task<T?> GetAsync<T>(string key)
        {
            if (_useRedis && _redisDatabase != null)
            {
                try
                {
                    var value = await _redisDatabase.StringGetAsync(key);
                    if (value.HasValue)
                    {
                        return JsonSerializer.Deserialize<T>(value!);
                    }
                    return default;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to read from Redis for key {Key}. Falling back to MemoryCache.", key);
                }
            }

            // Fallback to memory cache
            _memoryCache.TryGetValue(key, out T? memoryValue);
            return await Task.FromResult(memoryValue);
        }

        public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
        {
            var serializedValue = JsonSerializer.Serialize(value);

            if (_useRedis && _redisDatabase != null)
            {
                try
                {
                    await _redisDatabase.StringSetAsync(key, serializedValue, expiry: expiration.HasValue ? expiration.Value : default(StackExchange.Redis.Expiration));
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to write to Redis for key {Key}. Falling back to MemoryCache.", key);
                }
            }

            // Fallback to memory cache
            var cacheEntryOptions = new MemoryCacheEntryOptions();
            if (expiration.HasValue)
            {
                cacheEntryOptions.AbsoluteExpirationRelativeToNow = expiration.Value;
            }
            else
            {
                cacheEntryOptions.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10); // Default 10 mins
            }

            _memoryCache.Set(key, value, cacheEntryOptions);
            await Task.CompletedTask;
        }

        public async Task RemoveAsync(string key)
        {
            if (_useRedis && _redisDatabase != null)
            {
                try
                {
                    await _redisDatabase.KeyDeleteAsync(key);
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to delete from Redis for key {Key}. Falling back to MemoryCache.", key);
                }
            }

            _memoryCache.Remove(key);
            await Task.CompletedTask;
        }
    }
}
