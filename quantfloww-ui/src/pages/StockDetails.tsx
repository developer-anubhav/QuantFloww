import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { StockChart } from '../components/StockChart';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { ArrowLeft, Plus, Check, Loader2, AlertCircle, ShoppingBag } from 'lucide-react';
import { OrderBook } from '../components/OrderBook';
import { MarginCalculator } from '../components/MarginCalculator';

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
  const [activeTab, setActiveTab] = useState<'chart' | 'orderbook' | 'events' | 'margin' | 'trade'>('chart');

  // Trade form states
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeQuantity, setTradeQuantity] = useState<number>(10);
  const [tradeErrorMsg, setTradeErrorMsg] = useState('');
  const [tradeSuccessMsg, setTradeSuccessMsg] = useState('');

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

  // Fetch corporate events calendar
  const { data: events = [], isLoading: isEventsLoading } = useQuery<any[]>({
    queryKey: ['stockEvents', symbol],
    queryFn: async () => {
      const response = await api.get(`/stocks/${symbol}/events`);
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

  // Fetch user portfolio for balance and holdings verification
  const { data: portfolio } = useQuery<any>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const response = await api.get('/portfolio');
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const tradeMutation = useMutation({
    mutationFn: async (vars: { symbol: string; type: 'BUY' | 'SELL'; quantity: number }) => {
      const response = await api.post('/portfolio/trade', {
        stockSymbol: vars.symbol,
        type: vars.type,
        quantity: vars.quantity
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setTradeSuccessMsg(`Successfully executed order!`);
      setTradeErrorMsg('');
      setTimeout(() => setTradeSuccessMsg(''), 4000);
    },
    onError: (err: any) => {
      setTradeErrorMsg(err.response?.data?.message ?? 'Trade execution failed.');
      setTradeSuccessMsg('');
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

      {/* Tabs and Tab Content */}
      <div className="space-y-4">
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0c0c0f] rounded-xl p-1">
          {[
            { id: 'chart', label: 'Interactive Chart' },
            { id: 'orderbook', label: 'Order Book (L2)' },
            { id: 'events', label: 'Corporate Actions' },
            { id: 'margin', label: 'Leverage Calculator' },
            { id: 'trade', label: 'Paper Trading' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-sm border border-zinc-150 dark:border-zinc-850'
                  : 'text-zinc-500 hover:text-zinc-755 dark:hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'chart' && (
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
        )}

        {activeTab === 'orderbook' && (
          <OrderBook price={liveStock.price} symbol={liveStock.symbol} />
        )}

        {activeTab === 'events' && (
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Corporate Events Calendar</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Earnings announcements, dividend schedules, and corporate board meetings.
              </p>
            </div>
            {isEventsLoading ? (
              <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                <p className="text-xs mt-1">Loading corporate calendar...</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 ml-3.5 pl-6 space-y-6">
                {events.map((event) => (
                  <div key={event.id} className="relative">
                    <span className="absolute -left-[30px] top-1 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-[#0c0c0f] flex items-center justify-center text-[10px] text-blue-500 font-bold">
                      •
                    </span>
                    <div>
                      <span className="text-[9px] font-bold font-mono uppercase bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
                        {event.type}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono ml-2">
                        {new Date(event.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                      <h4 className="text-sm font-extrabold text-zinc-950 dark:text-zinc-50 mt-1.5">{event.title}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl leading-relaxed">{event.description}</p>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 pl-2">No corporate actions on schedule.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'margin' && (
          <MarginCalculator currentPrice={liveStock.price} />
        )}

        {activeTab === 'trade' && (
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5 pb-4 border-b border-zinc-100 dark:border-zinc-800/80 mb-4">
              <ShoppingBag className="w-4 h-4 text-blue-500" />
              Paper Trade Execution: {liveStock.symbol}
            </h3>

            {!isAuthenticated ? (
              <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Please log in to your account to execute paper trades.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Holdings & Balance Summary */}
                <div className="space-y-4">
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-150 dark:border-zinc-850 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Account Summary</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Available Cash:</span>
                      <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">
                        ₹{(portfolio?.balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const position = portfolio?.positions?.find(
                      (p: any) => p.stockSymbol.toUpperCase() === symbol?.toUpperCase()
                    );

                    if (!position) {
                      return (
                        <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-150 dark:border-zinc-850 rounded-xl p-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                          You do not currently own any shares of {symbol?.toUpperCase()}.
                        </div>
                      );
                    }

                    const currentVal = position.quantity * liveStock.price;
                    const costBasis = position.quantity * position.averageEntryPrice;
                    const pnl = currentVal - costBasis;
                    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

                    return (
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-150 dark:border-zinc-850 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Your Position</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div>
                            <span className="text-zinc-400 block text-[10px] uppercase">Shares Owned</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{position.quantity}</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[10px] uppercase">Average Cost</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">₹{position.averageEntryPrice.toFixed(2)}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-zinc-400 block text-[10px] uppercase">Current Value</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">₹{currentVal.toFixed(2)}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-zinc-400 block text-[10px] uppercase">Unrealized P&L</span>
                            <span className={`font-bold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ₹{pnl.toFixed(2)} ({pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Trade Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (tradeQuantity <= 0) {
                      setTradeErrorMsg('Quantity must be positive.');
                      return;
                    }
                    tradeMutation.mutate({
                      symbol: symbol!,
                      type: tradeType,
                      quantity: tradeQuantity
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 p-1 bg-zinc-105 dark:bg-zinc-950 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setTradeType('BUY')}
                      className={`py-1.5 text-xs font-black rounded-md cursor-pointer transition-all ${tradeType === 'BUY' ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-250'}`}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeType('SELL')}
                      className={`py-1.5 text-xs font-black rounded-md cursor-pointer transition-all ${tradeType === 'SELL' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-250'}`}
                    >
                      SELL
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Shares Quantity</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={tradeQuantity}
                      onChange={(e) => setTradeQuantity(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                    />
                  </div>

                  <div className="bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-800/40 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Execution Market Price</span>
                      <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">₹{liveStock.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-100 dark:border-zinc-800/40 pt-2">
                      <span className="text-zinc-400">{tradeType === 'BUY' ? 'Estimated Cost' : 'Estimated Proceeds'}</span>
                      <span className="font-mono font-black text-zinc-950 dark:text-zinc-50 text-sm">
                        ₹{(liveStock.price * tradeQuantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {tradeErrorMsg && (
                    <div className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded border border-rose-500/25">
                      {tradeErrorMsg}
                    </div>
                  )}
                  {tradeSuccessMsg && (
                    <div className="text-xs text-emerald-500 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/25">
                      {tradeSuccessMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={tradeMutation.isPending}
                    className={`w-full py-2 rounded-lg text-xs font-black text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      tradeMutation.isPending ? 'bg-zinc-600' :
                      tradeType === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-600' :
                      'bg-rose-500 hover:bg-rose-600'
                    }`}
                  >
                    {tradeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Executing Trade...
                      </>
                    ) : (
                      <>
                        Execute {tradeType} Order
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
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
