using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace QuantFloww.Infrastructure.RealTime
{
    public class MarketDataHub : Hub
    {
        public async Task SubscribeToTicker(string symbol)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, symbol);
        }

        public async Task UnsubscribeFromTicker(string symbol)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, symbol);
        }
    }
}
