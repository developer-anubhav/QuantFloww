import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { StockChart } from '../components/StockChart';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { ArrowLeft, Plus, Check, Loader2, AlertCircle } from 'lucide-react';

interface StockDetailsData {
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

interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Watchlist {
  id: string;
  name: string;
  items: Array<{ symbol: string }>;
}

export const StockDetails: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const darkMode = useSelector((state: RootState) => state.theme.darkMode);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  const [timeframe, setTimeframe] = useState<number>(30); // Default 30 days
  const [liveStock, setLiveStock] = useState<StockDetailsData | null>(null);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [watchlistSuccessMessage, setWatchlistSuccessMessage] = useState<string | null>(null);

  // Fetch static stock profile
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useQuery<StockDetailsData>({
    queryKey: ['stockProfile', symbol],
    queryFn: async () => {
      const response = await api.get(`/stocks/${symbol}`);
      return response.data;
    },
    enabled: !!symbol,
  });

  // Fetch historical data based on selected timeframe
  const { data: history = [], isLoading: isHistoryLoading } = useQuery<HistoricalData[]>({
    queryKey: ['stockHistory', symbol, timeframe],
    queryFn: async () => {
      const response = await api.get(`/stocks/${symbol}/history?days=${timeframe}`);
      return response.data;
    },
    enabled: !!symbol,
  });

  // Fetch user watchlists for the add-to-watchlist selector
  const { data: watchlists = [] } = useQuery<Watchlist[]>({
    queryKey: ['watchlists'],
    queryFn: async () => {
      const response = await api.get('/watchlists');
      return response.data;
    },
    enabled: isAuthenticated,
  });

  // Add item mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async ({ watchlistId, stockSymbol }: { watchlistId: string; stockSymbol: string }) => {
      return await api.post(`/watchlists/${watchlistId}/items`, { symbol: stockSymbol });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setWatchlistSuccessMessage('Added to watchlist!');
      setTimeout(() => setWatchlistSuccessMessage(null), 2500);
      setShowWatchlistModal(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to add item to watchlist.');
    }
  });

  // Sync initial profile loaded
  useEffect(() => {
    if (profile) {
      setLiveStock(profile);
    }
  }, [profile]);

  // Hook into live SignalR ticks
  const handleLiveTick = (update: any) => {
    if (update.symbol === symbol?.toUpperCase()) {
      setLiveStock((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          price: update.price,
          open: update.open,
          high: update.high,
          low: update.low,
          volume: update.volume,
          change: update.change,
          changePercent: update.changePercent,
          lastUpdated: update.lastUpdated,
        };
      });
    }
  };

  useSignalR(handleLiveTick);

  if (isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading asset terminal...</p>
      </div>
    );
  }

  if (profileError || !liveStock) {
    return (
      <div className="p-6 text-center max-w-md mx-auto">
        <h3 className="text-lg font-bold text-rose-500">Asset not found</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
          Unable to find stock with symbol {symbol}.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-zinc-800 text-white rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  const isPositive = liveStock.change >= 0;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      
      {/* Back to Console Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Terminal Console
        </button>

        {isAuthenticated && (
          <div className="flex items-center gap-3">
            {watchlistSuccessMessage && (
              <span className="text-xs font-medium text-emerald-500 animate-fade-in">
                {watchlistSuccessMessage}
              </span>
            )}
            <button
              onClick={() => setShowWatchlistModal(true)}
              className="inline-flex items-center gap-1.5 bg-zinc-950 dark:bg-zinc-800 hover:bg-zinc-900 dark:hover:bg-zinc-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer border border-zinc-800"
            >
              <Plus className="w-4 h-4" />
              Add to Watchlist
            </button>
          </div>
        )}
      </div>

      {/* Hero Stock Header */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-md border border-blue-500/20 uppercase">
              {liveStock.exchange}
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {liveStock.sector}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight mt-1.5">
            {liveStock.name} <span className="font-mono text-zinc-400 dark:text-zinc-500 text-xl font-bold ml-1">{liveStock.symbol}</span>
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Last tick: {new Date(liveStock.lastUpdated).toLocaleTimeString()}
          </p>
        </div>

        {/* Live LTP Box */}
        <div className="flex items-baseline md:text-right gap-3 md:flex-col md:gap-0.5">
          <div className="text-3xl font-black font-mono tracking-tight text-zinc-950 dark:text-zinc-50">
            {liveStock.price.toFixed(2)}
          </div>
          <span className={`inline-flex items-center gap-0.5 text-sm font-bold font-mono ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{liveStock.change.toFixed(2)} ({isPositive ? '+' : ''}{liveStock.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="space-y-4">
        {/* Timeframe selector */}
        <div className="flex justify-between items-center bg-zinc-50 dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 pl-2">Timeframe</span>
          <div className="flex bg-zinc-100 dark:bg-[#18181b] p-0.5 rounded-lg">
            {[
              { label: '1W', days: 7 },
              { label: '1M', days: 30 },
              { label: '3M', days: 90 },
              { label: '1Y', days: 365 }
            ].map((tf) => (
              <button
                key={tf.label}
                onClick={() => setTimeframe(tf.days)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  timeframe === tf.days
                    ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* TradingView Chart Wrapper */}
        {isHistoryLoading ? (
          <div className="h-[400px] flex items-center justify-center bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-2" />
            <span className="text-zinc-500 text-sm">Loading historical data...</span>
          </div>
        ) : (
          <StockChart data={history} symbol={liveStock.symbol} theme={darkMode ? 'dark' : 'light'} />
        )}
      </div>

      {/* Key Stats / Fundamentals Grid */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-5">
          Key Statistics & Fundamentals
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          {/* Open */}
          <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-3">
            <span className="text-zinc-400 dark:text-zinc-500 block text-xs">Open Price</span>
            <span className="font-extrabold font-mono text-zinc-950 dark:text-zinc-50 mt-1 block">
              {liveStock.open.toFixed(2)}
            </span>
          </div>

          {/* High */}
          <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-3">
            <span className="text-zinc-400 dark:text-zinc-500 block text-xs">Today's High</span>
            <span className="font-extrabold font-mono text-zinc-950 dark:text-zinc-50 mt-1 block text-emerald-500">
              {liveStock.high.toFixed(2)}
            </span>
          </div>

          {/* Low */}
          <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-3">
            <span className="text-zinc-400 dark:text-zinc-500 block text-xs">Today's Low</span>
            <span className="font-extrabold font-mono text-zinc-950 dark:text-zinc-50 mt-1 block text-rose-500">
              {liveStock.low.toFixed(2)}
            </span>
          </div>

          {/* Prev Close */}
          <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-3">
            <span className="text-zinc-400 dark:text-zinc-500 block text-xs">Previous Close</span>
            <span className="font-extrabold font-mono text-zinc-950 dark:text-zinc-50 mt-1 block">
              {liveStock.prevClose.toFixed(2)}
            </span>
          </div>

          {/* Volume */}
          <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-3 md:border-none md:pb-0">
            <span className="text-zinc-400 dark:text-zinc-500 block text-xs">Daily Volume</span>
            <span className="font-extrabold font-mono text-zinc-950 dark:text-zinc-50 mt-1 block">
              {liveStock.volume.toLocaleString()}
            </span>
          </div>

          {/* Market Cap */}
          <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-3 md:border-none md:pb-0">
            <span className="text-zinc-400 dark:text-zinc-500 block text-xs">Market Cap</span>
            <span className="font-extrabold font-mono text-zinc-950 dark:text-zinc-50 mt-1 block">
              ₹{(liveStock.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr
            </span>
          </div>

          {/* P/E Ratio */}
          <div className="md:border-none">
            <span className="text-zinc-400 dark:text-zinc-500 block text-xs">P/E Ratio</span>
            <span className="font-extrabold font-mono text-zinc-950 dark:text-zinc-50 mt-1 block">
              {liveStock.peRatio ? liveStock.peRatio.toFixed(2) : '--'}
            </span>
          </div>

          {/* Div Yield */}
          <div className="md:border-none">
            <span className="text-zinc-400 dark:text-zinc-500 block text-xs">Dividend Yield</span>
            <span className="font-extrabold font-mono text-zinc-950 dark:text-zinc-50 mt-1 block">
              {liveStock.dividendYield ? `${liveStock.dividendYield.toFixed(2)}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Watchlist Modal Overlay */}
      {showWatchlistModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-fade-in">
            <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 mb-4">Select Watchlist</h3>
            
            {watchlists.length === 0 ? (
              <div className="text-center p-6 text-zinc-500 dark:text-zinc-500">
                <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm">You have no watchlists yet.</p>
                <button
                  onClick={() => {
                    setShowWatchlistModal(false);
                    navigate('/watchlists');
                  }}
                  className="mt-3 text-xs text-blue-500 font-semibold hover:underline"
                >
                  Create one now
                </button>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
                {watchlists.map((wl) => {
                  const alreadyIn = wl.items.some(i => i.symbol.toUpperCase() === symbol?.toUpperCase());
                  return (
                    <button
                      key={wl.id}
                      disabled={alreadyIn || addToWatchlistMutation.isPending}
                      onClick={() => addToWatchlistMutation.mutate({ watchlistId: wl.id, stockSymbol: symbol! })}
                      className="w-full flex items-center justify-between p-3 border border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-all cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="font-semibold text-sm text-zinc-950 dark:text-zinc-100">{wl.name}</span>
                      {alreadyIn ? (
                        <span className="text-xs text-emerald-500 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Added
                        </span>
                      ) : (
                        <span className="text-xs text-blue-500 font-medium">Add</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowWatchlistModal(false)}
              className="w-full text-center text-xs font-semibold py-2.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
