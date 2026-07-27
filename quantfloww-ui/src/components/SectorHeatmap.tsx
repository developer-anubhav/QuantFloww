import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  marketCap: number;
}

interface SectorHeatmapProps {
  stocks: StockData[];
}

export const SectorHeatmap: React.FC<SectorHeatmapProps> = ({ stocks }) => {
  const navigate = useNavigate();

  // Group stocks by sector and calculate total market cap per sector
  const sectorData = useMemo(() => {
    const groups: Record<string, { stocks: StockData[]; totalCap: number }> = {};
    
    stocks.forEach(stock => {
      if (!groups[stock.sector]) {
        groups[stock.sector] = { stocks: [], totalCap: 0 };
      }
      groups[stock.sector].stocks.push(stock);
      groups[stock.sector].totalCap += stock.marketCap;
    });

    const totalMarketCap = Object.values(groups).reduce((sum, g) => sum + g.totalCap, 0);

    return Object.entries(groups).map(([name, group]) => ({
      name,
      stocks: group.stocks.sort((a, b) => b.marketCap - a.marketCap),
      totalCap: group.totalCap,
      weight: totalMarketCap > 0 ? (group.totalCap / totalMarketCap) * 100 : 0
    })).sort((a, b) => b.totalCap - a.totalCap);
  }, [stocks]);

  const getColorClass = (change: number) => {
    if (change <= -3) return 'bg-rose-950 border-rose-800 text-white hover:bg-rose-900/90';
    if (change < 0) return 'bg-rose-900 border-rose-800/80 text-rose-100 hover:bg-rose-800/90';
    if (change === 0) return 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700/90';
    if (change < 3) return 'bg-emerald-900 border-emerald-800/80 text-emerald-100 hover:bg-emerald-800/90';
    return 'bg-emerald-950 border-emerald-800 text-white hover:bg-emerald-900/90';
  };

  return (
    <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Market Sector Heatmap</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Visual representation grouped by sector. Size corresponds to market cap; color represents change.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sectorData.map(sector => (
          <div 
            key={sector.name} 
            className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50/50 dark:bg-[#09090b]/40 flex flex-col space-y-2.5"
            style={{ flexGrow: Math.max(1, Math.round(sector.weight)) }}
          >
            <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-1.5">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {sector.name}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                {(sector.totalCap / 1000000000000).toFixed(2)}T Cr
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 flex-1">
              {sector.stocks.map(stock => {
                // Determine layout column spanning based on market cap ratio
                const isBig = stock.marketCap > sector.totalCap * 0.45;
                const colSpan = isBig ? 'col-span-2' : 'col-span-1';

                return (
                  <button
                    key={stock.symbol}
                    onClick={() => navigate(`/stocks/${stock.symbol}`)}
                    className={`${colSpan} p-3 rounded-lg border text-left cursor-pointer flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-[1px] shadow-sm ${getColorClass(stock.changePercent)}`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="font-extrabold text-[12px] font-mono tracking-tight text-white">{stock.symbol}</span>
                      <span className={`text-[10px] font-bold ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <span className="block text-[11px] font-black font-mono text-white">
                        ₹{stock.price.toFixed(2)}
                      </span>
                      <span className="block text-[8px] text-zinc-300 uppercase tracking-wider font-semibold mt-0.5">
                        Cap: {(stock.marketCap / 100000000000).toFixed(1)}B Cr
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
