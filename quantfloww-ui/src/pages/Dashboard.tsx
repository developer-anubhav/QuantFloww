import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { Search, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { SectorHeatmap } from '../components/SectorHeatmap';
import { BlockDealsList, type BlockDeal } from '../components/BlockDealsList';

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  peRatio: number | null;
  dividendYield: number | null;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveStocks, setLiveStocks] = useState<StockData[]>([]);
  const [lastUpdatedTick, setLastUpdatedTick] = useState<Record<string, { price: number; dir: 'up' | 'down' | null }>>({});
  const [blockDeals, setBlockDeals] = useState<BlockDeal[]>([]);
  const [searchResults, setSearchResults] = useState<StockData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch initial stocks data
  const { data: initialStocks, isLoading, isError } = useQuery<StockData[]>({
    queryKey: ['stocks'],
    queryFn: async () => {
      const response = await api.get('/stocks');
      return response.data;
    },
  });

  // Sync initial stocks to local state
  useEffect(() => {
    if (initialStocks) {
      setLiveStocks(initialStocks);
    }
  }, [initialStocks]);

  // Debounced Global Search trigger
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);
      try {
        const response = await api.get(`/stocks/search?query=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data);
      } catch (err) {
        console.error('Error fetching search results:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Hook into real-time price updates via SignalR
  const handlePriceUpdate = (update: any) => {
    setLiveStocks((prevStocks) => {
      const index = prevStocks.findIndex((s) => s.symbol === update.symbol);
      if (index === -1) return prevStocks;

      const updatedStocks = [...prevStocks];
      const oldStock = updatedStocks[index];

      // Track price direction for blinking effects
      const direction = update.price > oldStock.price ? 'up' : update.price < oldStock.price ? 'down' : null;
      if (direction) {
        setLastUpdatedTick((prev) => ({
          ...prev,
          [update.symbol]: { price: update.price, dir: direction },
        }));

        // Reset flashing state after 800ms
        setTimeout(() => {
          setLastUpdatedTick((prev) => {
            if (prev[update.symbol]?.price === update.price) {
              return { ...prev, [update.symbol]: { price: update.price, dir: null } };
            }
            return prev;
          });
        }, 800);
      }

      updatedStocks[index] = {
        ...oldStock,
        price: update.price,
        open: update.open,
        high: update.high,
        low: update.low,
        volume: update.volume,
        change: update.change,
        changePercent: update.changePercent,
        lastUpdated: update.lastUpdated,
      };

      return updatedStocks;
    });
  };

  const handleBlockDeal = (deal: BlockDeal) => {
    setBlockDeals((prev) => [deal, ...prev].slice(0, 30));
  };

  const isConnected = useSignalR(handlePriceUpdate, handleBlockDeal);

  // Compute mock Indices based on the average prices of live stocks (makes them respond dynamically!)
  const indices = useMemo(() => {
    if (!liveStocks.length) return { nifty: { val: 0, change: 0, pct: 0 }, sensex: { val: 0, change: 0, pct: 0 } };

    const avgPrice = liveStocks.reduce((sum, s) => sum + s.price, 0) / liveStocks.length;
    const avgPrevClose = liveStocks.reduce((sum, s) => sum + s.prevClose, 0) / liveStocks.length;

    // Nifty scale ~ 10x average price
    const niftyVal = avgPrice * 7.5;
    const niftyPrev = avgPrevClose * 7.5;
    const niftyChange = niftyVal - niftyPrev;
    const niftyPct = (niftyChange / niftyPrev) * 100;

    // Sensex scale ~ 25x average price
    const sensexVal = avgPrice * 24.5;
    const sensexPrev = avgPrevClose * 24.5;
    const sensexChange = sensexVal - sensexPrev;
    const sensexPct = (sensexChange / sensexPrev) * 100;

    return {
      nifty: { val: Math.round(niftyVal * 100) / 100, change: Math.round(niftyChange * 100) / 100, pct: Math.round(niftyPct * 100) / 100 },
      sensex: { val: Math.round(sensexVal * 100) / 100, change: Math.round(sensexChange * 100) / 100, pct: Math.round(sensexPct * 100) / 100 },
    };
  }, [liveStocks]);

  // Filters & Sorters for widgets
  const filteredStocks = useMemo(() => {
    return liveStocks.filter(
      (s) =>
        s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [liveStocks, searchQuery]);

  const topGainers = useMemo(() => {
    return [...liveStocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 4);
  }, [liveStocks]);

  const topLosers = useMemo(() => {
    return [...liveStocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 4);
  }, [liveStocks]);



  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-125">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading market console...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center max-w-md mx-auto">
        <h3 className="text-lg font-bold text-rose-500">Error loading dashboard</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
          Make sure the backend API is running at http://localhost:5280.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8">
      
      {/* Real-time Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight flex items-center gap-2">
            Market Intelligence Console
            {isConnected && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                LIVE
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time streaming index values and equity metrics.
          </p>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-80" onClick={(e) => e.stopPropagation()}>
          <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search NSE/BSE stocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-zinc-950 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 transition-all"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-blue-500" />
          )}

          {/* Floating Global Search Results Dropdown */}
          {showDropdown && (searchResults.length > 0 || isSearching) && (
            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 max-h-85 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80 animate-fade-in select-none">
              {isSearching ? (
                <div className="p-4 text-center text-xs text-zinc-405 dark:text-zinc-500">
                  Searching NSE/BSE exchanges...
                </div>
              ) : (
                searchResults.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => {
                      setShowDropdown(false);
                      setSearchQuery('');
                      navigate(`/stocks/${stock.symbol}`);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <span className="font-extrabold text-xs font-mono text-zinc-950 dark:text-zinc-50">{stock.symbol}</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-2 uppercase font-semibold">
                        {stock.exchange}
                      </span>
                      <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate max-w-45">{stock.name}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-zinc-950 dark:text-zinc-100">
                        ₹{stock.price.toFixed(2)}
                      </span>
                      <p className={`text-[10px] font-mono font-bold ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Indices Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NIFTY 50 */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex justify-between items-center relative overflow-hidden">
          <div>
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">INDEX</span>
            <h2 className="text-xl font-extrabold text-zinc-950 dark:text-zinc-50 mt-1">NIFTY 50</h2>
            <div className="text-2xl font-black font-mono tracking-tight text-zinc-950 dark:text-zinc-50 mt-2">
              {indices.nifty.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              indices.nifty.change >= 0 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
            }`}>
              {indices.nifty.change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {indices.nifty.change >= 0 ? '+' : ''}{indices.nifty.change.toFixed(2)} ({indices.nifty.pct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* SENSEX */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex justify-between items-center relative overflow-hidden">
          <div>
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">INDEX</span>
            <h2 className="text-xl font-extrabold text-zinc-950 dark:text-zinc-50 mt-1">SENSEX</h2>
            <div className="text-2xl font-black font-mono tracking-tight text-zinc-950 dark:text-zinc-50 mt-2">
              {indices.sensex.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              indices.sensex.change >= 0 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
            }`}>
              {indices.sensex.change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {indices.sensex.change >= 0 ? '+' : ''}{indices.sensex.change.toFixed(2)} ({indices.sensex.pct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Sector Heatmap */}
      <SectorHeatmap stocks={liveStocks} />

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Stocks Grid list (takes 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">Active Tickers</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-[#18181b] border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider font-bold">
                    <th className="p-4">Symbol</th>
                    <th className="p-4">Company Name</th>
                    <th className="p-4 text-right">LTP</th>
                    <th className="p-4 text-right">Change</th>
                    <th className="p-4 text-right">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredStocks.map((stock) => {
                    const priceTick = lastUpdatedTick[stock.symbol];
                    const tickBgClass = priceTick?.dir === 'up' 
                      ? 'bg-emerald-500/10 transition-colors duration-100' 
                      : priceTick?.dir === 'down' 
                        ? 'bg-rose-500/10 transition-colors duration-100' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30';

                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => navigate(`/stocks/${stock.symbol}`)}
                        className={`cursor-pointer transition-colors duration-300 ${tickBgClass}`}
                      >
                        <td className="p-4 font-extrabold text-zinc-950 dark:text-zinc-50 font-mono">{stock.symbol}</td>
                        <td className="p-4 text-zinc-500 dark:text-zinc-400 text-sm max-w-xs truncate">{stock.name}</td>
                        <td className="p-4 text-right font-black font-mono text-zinc-950 dark:text-zinc-50">
                          {stock.price.toFixed(2)}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-semibold font-mono text-sm ${stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="p-4 text-right text-zinc-500 dark:text-zinc-400 font-mono text-sm">
                          {stock.volume.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStocks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-zinc-500 dark:text-zinc-500">
                        No symbols match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Mini Tables (Gainers, Losers) */}
        <div className="space-y-6">
          {/* Top Gainers */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Top Gainers
            </h3>
            <div className="space-y-3.5">
              {topGainers.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => navigate(`/stocks/${stock.symbol}`)}
                  className="flex justify-between items-center p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors"
                >
                  <div>
                    <span className="font-extrabold text-zinc-950 dark:text-zinc-50 font-mono">{stock.symbol}</span>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-37.5">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-black text-zinc-950 dark:text-zinc-50">{stock.price.toFixed(2)}</span>
                    <p className="text-xs font-semibold text-emerald-500 font-mono">+{stock.changePercent.toFixed(2)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              Top Losers
            </h3>
            <div className="space-y-3.5">
              {topLosers.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => navigate(`/stocks/${stock.symbol}`)}
                  className="flex justify-between items-center p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors"
                >
                  <div>
                    <span className="font-extrabold text-zinc-950 dark:text-zinc-50 font-mono">{stock.symbol}</span>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-37.5">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-black text-zinc-950 dark:text-zinc-50">{stock.price.toFixed(2)}</span>
                    <p className="text-xs font-semibold text-rose-500 font-mono">{stock.changePercent.toFixed(2)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Whale Watch Live Block Deals */}
          <BlockDealsList deals={blockDeals} />
        </div>

      </div>

    </div>
  );
};
