import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { Briefcase, ArrowUpRight, ArrowDownRight, DollarSign, Activity, History, ShoppingBag, Loader2 } from 'lucide-react';

interface PositionData {
  id: string;
  stockSymbol: string;
  quantity: number;
  averageEntryPrice: number;
  lastUpdated: string;
}

interface TransactionData {
  id: string;
  stockSymbol: string;
  type: string; // "BUY" or "SELL"
  quantity: number;
  price: number;
  executedAt: string;
}

interface PortfolioData {
  id: string;
  userId: string;
  balance: number;
  positions: PositionData[];
  transactions: TransactionData[];
}

interface StockMarketPrice {
  symbol: string;
  price: number;
  changePercent: number;
}

export const Portfolio: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [livePrices, setLivePrices] = useState<Record<string, StockMarketPrice>>({});
  const [lastUpdatedTick, setLastUpdatedTick] = useState<Record<string, { price: number; dir: 'up' | 'down' | null }>>({});

  // Trade form states
  const [tradeSymbol, setTradeSymbol] = useState('');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeQuantity, setTradeQuantity] = useState<number>(10);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch all stocks to populate selection or validate symbols
  const { data: stocks = [] } = useQuery<any[]>({
    queryKey: ['stocks'],
    queryFn: async () => {
      const response = await api.get('/stocks');
      return response.data;
    }
  });

  // Fetch user portfolio
  const { data: initialPortfolio, isLoading, isError } = useQuery<PortfolioData>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const response = await api.get('/portfolio');
      return response.data;
    }
  });

  // Local copy of portfolio to allow live ticking calculations
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  useEffect(() => {
    if (initialPortfolio) {
      setPortfolio(initialPortfolio);
      // Pre-populate trade symbol if empty
      if (initialPortfolio.positions.length > 0 && !tradeSymbol) {
        setTradeSymbol(initialPortfolio.positions[0].stockSymbol);
      } else if (stocks.length > 0 && !tradeSymbol) {
        setTradeSymbol(stocks[0].symbol);
      }
    }
  }, [initialPortfolio, stocks]);

  // Map initial prices from stock list
  useEffect(() => {
    if (stocks.length > 0) {
      const priceMap: Record<string, StockMarketPrice> = {};
      stocks.forEach(s => {
        priceMap[s.symbol.toUpperCase()] = {
          symbol: s.symbol,
          price: s.price,
          changePercent: s.changePercent
        };
      });
      setLivePrices(priceMap);
    }
  }, [stocks]);

  // Hook into live SignalR price updates
  const handlePriceUpdate = (update: any) => {
    const symbolUpper = update.symbol.toUpperCase();
    
    setLivePrices(prev => {
      const oldPrice = prev[symbolUpper]?.price ?? update.price;
      const direction = update.price > oldPrice ? 'up' : update.price < oldPrice ? 'down' : null;

      if (direction) {
        setLastUpdatedTick(tickPrev => ({
          ...tickPrev,
          [symbolUpper]: { price: update.price, dir: direction }
        }));

        setTimeout(() => {
          setLastUpdatedTick(tickPrev => {
            if (tickPrev[symbolUpper]?.price === update.price) {
              return { ...tickPrev, [symbolUpper]: { price: update.price, dir: null } };
            }
            return tickPrev;
          });
        }, 800);
      }

      return {
        ...prev,
        [symbolUpper]: {
          symbol: update.symbol,
          price: update.price,
          changePercent: update.changePercent
        }
      };
    });
  };

  useSignalR(handlePriceUpdate);

  // Execute trade mutation
  const tradeMutation = useMutation({
    mutationFn: async (vars: { symbol: string; type: 'BUY' | 'SELL'; quantity: number }) => {
      const response = await api.post('/portfolio/trade', {
        stockSymbol: vars.symbol,
        type: vars.type,
        quantity: vars.quantity
      });
      return response.data;
    },
    onSuccess: (data) => {
      setPortfolio(data);
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setSuccessMsg(`Successfully executed order: ${tradeType} ${tradeQuantity} shares of ${tradeSymbol}`);
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message ?? 'Trade execution failed.');
      setSuccessMsg('');
    }
  });

  const handleTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeSymbol) {
      setErrorMsg('Please select a stock symbol.');
      return;
    }
    if (tradeQuantity <= 0) {
      setErrorMsg('Quantity must be positive.');
      return;
    }
    tradeMutation.mutate({
      symbol: tradeSymbol,
      type: tradeType,
      quantity: tradeQuantity
    });
  };

  // Live ticking portfolio statistics
  const portfolioStats = useMemo(() => {
    if (!portfolio) return { cash: 0, holdingsValue: 0, nav: 0, totalCost: 0, pnl: 0, pnlPercent: 0 };

    let holdingsValue = 0;
    let totalCost = 0;

    portfolio.positions.forEach(pos => {
      const symbolUpper = pos.stockSymbol.toUpperCase();
      const currentPrice = livePrices[symbolUpper]?.price ?? pos.averageEntryPrice;
      holdingsValue += pos.quantity * currentPrice;
      totalCost += pos.quantity * pos.averageEntryPrice;
    });

    const cash = portfolio.balance;
    const nav = cash + holdingsValue;
    const pnl = holdingsValue - totalCost;
    const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

    return { cash, holdingsValue, nav, totalCost, pnl, pnlPercent };
  }, [portfolio, livePrices]);

  if (isLoading || !portfolio) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  const selectedStockPrice = livePrices[tradeSymbol.toUpperCase()]?.price ?? 0;
  const estimatedCost = selectedStockPrice * tradeQuantity;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 animate-fade-in select-none">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight flex items-center gap-2">
          <Briefcase className="w-8 h-8 text-blue-500" />
          Quant Portfolio Console
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Simulated paper trading terminal with live marking-to-market.
        </p>
      </div>

      {/* NAV Banner widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* NAV Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Net Asset Value (NAV)</span>
          <span className="text-2xl font-black font-mono text-zinc-950 dark:text-zinc-50 mt-2 block">
            ₹{portfolioStats.nav.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-1">Ticking Total Equity</span>
        </div>

        {/* Free Cash Balance */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Free Cash Balance</span>
          <span className="text-2xl font-black font-mono text-zinc-950 dark:text-zinc-50 mt-2 block">
            ₹{portfolioStats.cash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-1">Available to Trade</span>
        </div>

        {/* Position Value */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Asset Exposure Value</span>
          <span className="text-2xl font-black font-mono text-zinc-950 dark:text-zinc-50 mt-2 block">
            ₹{portfolioStats.holdingsValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-1">Aggregate Holdings Value</span>
        </div>

        {/* PnL Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Unrealized P&L</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-black font-mono ${portfolioStats.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              ₹{portfolioStats.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex items-center font-mono ${portfolioStats.pnl >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
              {portfolioStats.pnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {portfolioStats.pnlPercent.toFixed(2)}%
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-1">Live Profit/Loss Summary</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Positions & History List (70%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Positions */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-500" />
                Open Holdings Exposure
              </h2>
              <span className="text-xs text-zinc-400 font-bold">{portfolio.positions.length} Positions</span>
            </div>

            {portfolio.positions.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                You currently have no open holdings. Use the panel on the right to place a paper trade.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse mt-2">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800/60 text-[11px] font-bold uppercase text-zinc-400 tracking-wider">
                      <th className="py-3">Asset</th>
                      <th className="py-3 text-right">Shares</th>
                      <th className="py-3 text-right">Avg Entry</th>
                      <th className="py-3 text-right">Last Price</th>
                      <th className="py-3 text-right">Current Value</th>
                      <th className="py-3 text-right">Returns</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40 text-sm">
                    {portfolio.positions.map((pos) => {
                      const symbolUpper = pos.stockSymbol.toUpperCase();
                      const currentPrice = livePrices[symbolUpper]?.price ?? pos.averageEntryPrice;
                      const tickInfo = lastUpdatedTick[symbolUpper];
                      
                      const currentVal = pos.quantity * currentPrice;
                      const costBasis = pos.quantity * pos.averageEntryPrice;
                      const itemPnl = currentVal - costBasis;
                      const itemPnlPercent = costBasis > 0 ? (itemPnl / costBasis) * 100 : 0;

                      return (
                        <tr key={pos.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                          <td className="py-3">
                            <span 
                              onClick={() => navigate(`/stocks/${pos.stockSymbol}`)}
                              className="font-extrabold font-mono text-blue-500 hover:underline cursor-pointer"
                            >
                              {pos.stockSymbol}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-zinc-800 dark:text-zinc-100">{pos.quantity}</td>
                          <td className="py-3 text-right font-mono text-zinc-500 dark:text-zinc-400">₹{pos.averageEntryPrice.toFixed(2)}</td>
                          <td className={`py-3 text-right font-mono font-bold transition-all duration-300 ${
                            tickInfo?.dir === 'up' ? 'text-emerald-400 scale-[1.02]' : 
                            tickInfo?.dir === 'down' ? 'text-rose-400 scale-[1.02]' : 
                            'text-zinc-950 dark:text-zinc-200'
                          }`}>
                            ₹{currentPrice.toFixed(2)}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            ₹{currentVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`py-3 text-right font-mono font-bold ${itemPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <div>{itemPnl >= 0 ? '+' : ''}{itemPnl.toFixed(2)}</div>
                            <div className="text-[10px] font-semibold">{itemPnl >= 0 ? '+' : ''}{itemPnlPercent.toFixed(2)}%</div>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => {
                                setTradeSymbol(pos.stockSymbol);
                                setTradeType('SELL');
                                setTradeQuantity(pos.quantity);
                              }}
                              className="text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded transition-colors cursor-pointer"
                            >
                              Sell Position
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Trade Execution Ledger */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-500" />
                Execution Ledger History
              </h2>
              <span className="text-xs text-zinc-400 font-bold">{portfolio.transactions.length} Trades</span>
            </div>

            {portfolio.transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                No trading transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-80">
                <table className="w-full text-left border-collapse mt-2">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800/60 text-[11px] font-bold uppercase text-zinc-400 tracking-wider">
                      <th className="py-2.5">Time</th>
                      <th className="py-2.5">Asset</th>
                      <th className="py-2.5">Action</th>
                      <th className="py-2.5 text-right">Shares</th>
                      <th className="py-2.5 text-right">Price</th>
                      <th className="py-2.5 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40 text-xs font-mono">
                    {portfolio.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/5 transition-colors">
                        <td className="py-2.5 text-zinc-400 dark:text-zinc-500">
                          {new Date(tx.executedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })}
                        </td>
                        <td className="py-2.5 font-bold text-zinc-800 dark:text-zinc-200">{tx.stockSymbol}</td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${tx.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-bold text-zinc-800 dark:text-zinc-100">{tx.quantity}</td>
                        <td className="py-2.5 text-right text-zinc-500 dark:text-zinc-400">₹{tx.price.toFixed(2)}</td>
                        <td className="py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-200">₹{(tx.price * tx.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Order execution widget (30%) */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <ShoppingBag className="w-4 h-4 text-blue-500" />
              Place Paper Trade
            </h2>

            <form onSubmit={handleTradeSubmit} className="space-y-5 mt-4">
              
              {/* Buy / Sell selector toggle */}
              <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-900/60 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTradeType('BUY')}
                  className={`py-1.5 text-xs font-black rounded-md cursor-pointer transition-all ${tradeType === 'BUY' ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-250'}`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setTradeType('SELL')}
                  className={`py-1.5 text-xs font-black rounded-md cursor-pointer transition-all ${tradeType === 'SELL' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-250'}`}
                >
                  SELL
                </button>
              </div>

              {/* Stock Symbol Selection */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Asset Symbol</label>
                <select
                  value={tradeSymbol}
                  onChange={(e) => setTradeSymbol(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {stocks.map(s => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} - {s.name} (₹{(livePrices[s.symbol.toUpperCase()]?.price ?? s.price).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Shares quantity input */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Quantity (Shares)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={tradeQuantity}
                  onChange={(e) => setTradeQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                />
              </div>

              {/* Cost / Proceeds Details */}
              <div className="bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-800/40 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Current Market Price</span>
                  <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">₹{selectedStockPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-100 dark:border-zinc-800/40 pt-2">
                  <span className="text-zinc-400">{tradeType === 'BUY' ? 'Est. Total Cost' : 'Est. Total Proceeds'}</span>
                  <span className="font-mono font-black text-zinc-950 dark:text-zinc-50 text-sm">
                    ₹{estimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Error and Success notifications */}
              {errorMsg && (
                <div className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded border border-rose-500/25">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="text-xs text-emerald-500 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/25">
                  {successMsg}
                </div>
              )}

              {/* Form submit button */}
              <button
                type="submit"
                disabled={tradeMutation.isPending}
                className={`w-full py-2.5 rounded-lg text-sm font-black text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  tradeMutation.isPending ? 'bg-zinc-600 cursor-not-allowed' :
                  tradeType === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/10' :
                  'bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-500/10'
                }`}
              >
                {tradeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executing Order...
                  </>
                ) : (
                  <>
                    Execute {tradeType} Order
                  </>
                )}
              </button>

            </form>
          </div>
        </div>

      </div>

    </div>
  );
};
