import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface OrderBookProps {
  price: number;
  symbol: string;
}

export const OrderBook: React.FC<OrderBookProps> = ({ price, symbol }) => {
  // Generate random order book levels based on current price
  const bookData = useMemo(() => {
    const random = new RandomSeed(symbol.charCodeAt(0) + Math.round(price * 100));
    const spreadPercent = 0.0004; // 0.04% spread
    const tickSize = 0.05; // 5 paise ticks

    const bids: Array<{ price: number; size: number }> = [];
    const asks: Array<{ price: number; size: number }> = [];

    const baseBid = Math.round((price * (1 - spreadPercent)) / tickSize) * tickSize;
    const baseAsk = Math.round((price * (1 + spreadPercent)) / tickSize) * tickSize;

    // Generate 5 levels of bids and asks
    for (let i = 0; i < 5; i++) {
      bids.push({
        price: baseBid - i * tickSize,
        size: Math.round(random.nextRange(100, 5000))
      });

      asks.push({
        price: baseAsk + i * tickSize,
        size: Math.round(random.nextRange(100, 5000))
      });
    }

    // Cumulative sums for depth representation
    let bidTotal = 0;
    const bidsWithTotals = bids.map(b => {
      bidTotal += b.size;
      return { ...b, total: bidTotal };
    });

    let askTotal = 0;
    const asksWithTotals = asks.map(a => {
      askTotal += a.size;
      return { ...a, total: askTotal };
    }).reverse(); // Asks sorted descending visually (highest on top)

    const maxTotal = Math.max(bidTotal, askTotal);

    return {
      asks: asksWithTotals,
      bids: bidsWithTotals,
      maxTotal,
      spread: baseAsk - baseBid,
      spreadPercent: ((baseAsk - baseBid) / price) * 100
    };
  }, [price, symbol]);

  return (
    <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">L2 Market Depth</h3>
        <p className="text-xs text-zinc-450 dark:text-zinc-550">
          Simulated order matching depth queues.
        </p>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden select-none">
        
        {/* Table Headings */}
        <div className="grid grid-cols-3 p-2 bg-zinc-50 dark:bg-[#18181b] border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider">
          <div>Price (₹)</div>
          <div className="text-right">Size</div>
          <div className="text-right">Total Volume</div>
        </div>

        {/* Asks (Sell Orders) - Red */}
        <div className="divide-y divide-zinc-100/50 dark:divide-zinc-800/40">
          {bookData.asks.map((ask, index) => {
            const depthPercent = (ask.total / bookData.maxTotal) * 100;
            return (
              <div 
                key={`ask-${index}`} 
                className="grid grid-cols-3 p-2 text-[11px] font-mono relative hover:bg-zinc-50 dark:hover:bg-zinc-800/10 transition-colors"
              >
                {/* Visual Depth Bar Graph */}
                <div 
                  className="absolute right-0 top-0 bottom-0 bg-rose-500/5 dark:bg-rose-500/10 pointer-events-none transition-all duration-300"
                  style={{ width: `${depthPercent}%` }}
                />
                <div className="text-rose-500 dark:text-rose-400 font-bold z-10">{ask.price.toFixed(2)}</div>
                <div className="text-right text-zinc-800 dark:text-zinc-300 z-10">{ask.size.toLocaleString()}</div>
                <div className="text-right text-zinc-400 dark:text-zinc-500 z-10">{ask.total.toLocaleString()}</div>
              </div>
            );
          })}
        </div>

        {/* Spread / Mid-Market Price Row */}
        <div className="grid grid-cols-3 p-3 bg-zinc-100/50 dark:bg-[#18181b]/60 border-y border-zinc-200 dark:border-zinc-800 text-xs items-center">
          <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-zinc-50 font-mono">
            ₹{price.toFixed(2)}
            {bookData.spreadPercent > 0 ? (
              <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-rose-500" />
            )}
          </div>
          <div className="text-right text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
            Spread
          </div>
          <div className="text-right text-[10px] font-mono text-zinc-650 dark:text-zinc-500">
            {bookData.spread.toFixed(2)} ({bookData.spreadPercent.toFixed(2)}%)
          </div>
        </div>

        {/* Bids (Buy Orders) - Green */}
        <div className="divide-y divide-zinc-100/50 dark:divide-zinc-800/40">
          {bookData.bids.map((bid, index) => {
            const depthPercent = (bid.total / bookData.maxTotal) * 100;
            return (
              <div 
                key={`bid-${index}`} 
                className="grid grid-cols-3 p-2 text-[11px] font-mono relative hover:bg-zinc-50 dark:hover:bg-zinc-800/10 transition-colors"
              >
                {/* Visual Depth Bar Graph */}
                <div 
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none transition-all duration-300"
                  style={{ width: `${depthPercent}%` }}
                />
                <div className="text-emerald-500 dark:text-emerald-400 font-bold z-10">{bid.price.toFixed(2)}</div>
                <div className="text-right text-zinc-800 dark:text-zinc-300 z-10">{bid.size.toLocaleString()}</div>
                <div className="text-right text-zinc-400 dark:text-zinc-500 z-10">{bid.total.toLocaleString()}</div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

// Seedable Random helper for deterministic order book changes
class RandomSeed {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  nextRange(min: number, max: number) {
    return min + this.next() * (max - min);
  }
}
