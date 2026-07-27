import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSignalR } from '../hooks/useSignalR';
import { Plus, Trash2, Loader2, List, Eye } from 'lucide-react';


interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

interface Watchlist {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  items: WatchlistItem[];
}

export const Watchlists: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [liveWatchlists, setLiveWatchlists] = useState<Watchlist[]>([]);
  const [lastUpdatedTick, setLastUpdatedTick] = useState<Record<string, { price: number; dir: 'up' | 'down' | null }>>({});

  // Fetch all user watchlists
  const { data: watchlists = [], isLoading, isError } = useQuery<Watchlist[]>({
    queryKey: ['watchlists'],
    queryFn: async () => {
      const response = await api.get('/watchlists');
      return response.data;
    },
  });

  // Sync initial query load to local state
  useEffect(() => {
    if (watchlists.length > 0) {
      setLiveWatchlists(watchlists);
      // Default to first watchlist if none is active
      if (!activeWatchlistId) {
        setActiveWatchlistId(watchlists[0].id);
      }
    } else {
      setLiveWatchlists([]);
      setActiveWatchlistId('');
    }
  }, [watchlists]);

  // Hook into live SignalR updates to dynamically update items in-place!
  const handlePriceUpdate = (update: any) => {
    setLiveWatchlists((prevWatchlists) => {
      return prevWatchlists.map((wl) => {
        const itemIndex = wl.items.findIndex((item) => item.symbol === update.symbol);
        if (itemIndex === -1) return wl;

        const updatedItems = [...wl.items];
        const oldItem = updatedItems[itemIndex];

        // Track flash direction
        const direction = update.price > oldItem.price ? 'up' : update.price < oldItem.price ? 'down' : null;
        if (direction && wl.id === activeWatchlistId) {
          setLastUpdatedTick((prev) => ({
            ...prev,
            [update.symbol]: { price: update.price, dir: direction },
          }));

          setTimeout(() => {
            setLastUpdatedTick((prev) => {
              if (prev[update.symbol]?.price === update.price) {
                return { ...prev, [update.symbol]: { price: update.price, dir: null } };
              }
              return prev;
            });
          }, 800);
        }

        updatedItems[itemIndex] = {
          ...oldItem,
          price: update.price,
          change: update.change,
          changePercent: update.changePercent,
          lastUpdated: update.lastUpdated,
        };

        return { ...wl, items: updatedItems };
      });
    });
  };

  useSignalR(handlePriceUpdate);

  // Active watchlist object
  const activeWatchlist = useMemo(() => {
    return liveWatchlists.find((w) => w.id === activeWatchlistId);
  }, [liveWatchlists, activeWatchlistId]);

  // Mutation: Create Watchlist
  const createWatchlistMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/watchlists', { name });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setNewWatchlistName('');
      setActiveWatchlistId(data.id);
    },
  });

  // Mutation: Delete Watchlist
  const deleteWatchlistMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/watchlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setActiveWatchlistId('');
    },
  });

  // Mutation: Remove Item from Watchlist
  const removeItemMutation = useMutation({
    mutationFn: async ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) => {
      await api.delete(`/watchlists/${watchlistId}/items/${symbol}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });

  const handleCreateWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchlistName.trim()) return;
    createWatchlistMutation.mutate(newWatchlistName);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading watchlists terminal...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center max-w-md mx-auto">
        <h3 className="text-lg font-bold text-rose-500">Error Loading Watchlists</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
          Make sure your credentials are active.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight">Your Watchlists</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Monitor your curated stocks with real-time streaming price changes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar: Select or Create Watchlists (takes 1 col) */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Create Watchlist Card */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">
              Create New Watchlist
            </h3>
            <form onSubmit={handleCreateWatchlist} className="space-y-3">
              <input
                type="text"
                placeholder="e.g. My Techs"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="submit"
                disabled={createWatchlistMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Watchlist
              </button>
            </form>
          </div>

          {/* Watchlists List Selector */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">
              Your Watchlist Sets
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {liveWatchlists.map((wl) => (
                <button
                  key={wl.id}
                  onClick={() => setActiveWatchlistId(wl.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    activeWatchlistId === wl.id
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border border-transparent'
                  }`}
                >
                  <span className="truncate">{wl.name}</span>
                  <span className="font-mono text-zinc-400 dark:text-zinc-500 text-[10px] ml-1 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    {wl.items.length}
                  </span>
                </button>
              ))}
              {liveWatchlists.length === 0 && (
                <p className="text-xs text-zinc-500 py-2 text-center">No watchlists found.</p>
              )}
            </div>
          </div>

        </div>

        {/* Right Area: Watchlist stocks table (takes 3 cols) */}
        <div className="lg:col-span-3">
          {activeWatchlist ? (
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0f]">
                <div>
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{activeWatchlist.name}</h3>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Created on {new Date(activeWatchlist.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this watchlist?')) {
                      deleteWatchlistMutation.mutate(activeWatchlist.id);
                    }
                  }}
                  disabled={deleteWatchlistMutation.isPending}
                  className="flex items-center gap-1 text-rose-500 hover:text-rose-600 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-500/10 hover:bg-rose-500/5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete List
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-[#18181b] border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider font-bold">
                      <th className="p-4">Symbol</th>
                      <th className="p-4">Company Name</th>
                      <th className="p-4 text-right">Live Price</th>
                      <th className="p-4 text-right">Change</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {activeWatchlist.items.map((item) => {
                      const priceTick = lastUpdatedTick[item.symbol];
                      const tickBgClass = priceTick?.dir === 'up' 
                        ? 'bg-emerald-500/10 transition-colors duration-100' 
                        : priceTick?.dir === 'down' 
                          ? 'bg-rose-500/10 transition-colors duration-100' 
                          : '';

                      return (
                        <tr key={item.id} className={`transition-all duration-300 ${tickBgClass}`}>
                          <td className="p-4 font-extrabold text-zinc-950 dark:text-zinc-50 font-mono">{item.symbol}</td>
                          <td className="p-4 text-zinc-500 dark:text-zinc-400 text-sm max-w-xs truncate">{item.name}</td>
                          <td className="p-4 text-right font-black font-mono text-zinc-950 dark:text-zinc-50">
                            {item.price.toFixed(2)}
                          </td>
                          <td className="p-4 text-right">
                            <span className={`font-semibold font-mono text-sm ${item.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => navigate(`/stocks/${item.symbol}`)}
                                className="p-1.5 text-blue-500 hover:text-blue-600 rounded hover:bg-blue-500/10 transition-colors cursor-pointer"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeItemMutation.mutate({ watchlistId: activeWatchlist.id, symbol: item.symbol })}
                                className="p-1.5 text-zinc-400 hover:text-rose-500 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Remove Stock"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {activeWatchlist.items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-zinc-500 dark:text-zinc-550">
                          This watchlist has no stocks. Navigate to Dashboard to add some!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center text-zinc-500 dark:text-zinc-550 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
              <List className="w-12 h-12 text-zinc-400 dark:text-zinc-650 mb-3" />
              <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-100">No Watchlist Active</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Select one from the sidebar or create a new set to monitor custom tickers.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
