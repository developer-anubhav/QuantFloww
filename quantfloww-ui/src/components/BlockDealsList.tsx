import React from 'react';
import { Shield, ArrowRight, TrendingUp } from 'lucide-react';

export interface BlockDeal {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  valueCr: number;
  buyer: string;
  seller: string;
  time: string;
}

interface BlockDealsListProps {
  deals: BlockDeal[];
}

export const BlockDealsList: React.FC<BlockDealsListProps> = ({ deals }) => {
  return (
    <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col h-[400px]">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-500 animate-pulse" />
            Whale Watch (Live Block Deals)
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
            Real-time tracking of institutional transactions.
          </p>
        </div>
        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-bold">
          LIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 select-none scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {deals.map(deal => (
          <div 
            key={deal.id}
            className="p-3 bg-zinc-50 dark:bg-[#09090b]/60 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col gap-2 transition-all duration-300 hover:border-blue-500/30"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-black text-zinc-950 dark:text-zinc-50 bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                  {deal.symbol}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(deal.time).toLocaleTimeString()}
                </span>
              </div>
              <span className="text-xs font-black font-mono text-blue-500 dark:text-blue-400">
                ₹{deal.valueCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <div>
                <span className="block text-[9px] text-zinc-400 uppercase font-semibold">Quantity</span>
                <span className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">
                  {deal.quantity.toLocaleString()} shares
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[9px] text-zinc-400 uppercase font-semibold">Trade Price</span>
                <span className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">
                  ₹{deal.price.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-[10px] bg-zinc-100 dark:bg-zinc-800/40 p-1.5 rounded flex items-center justify-between gap-1 text-zinc-400">
              <span className="truncate max-w-[100px] text-rose-400 font-medium" title={deal.seller}>
                {deal.seller}
              </span>
              <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" />
              <span className="truncate max-w-[100px] text-emerald-400 font-medium text-right" title={deal.buyer}>
                {deal.buyer}
              </span>
            </div>
          </div>
        ))}
        {deals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-10">
            <TrendingUp className="w-8 h-8 text-zinc-650 animate-bounce mb-2" />
            <p className="text-xs">Listening for institutional whale block trades...</p>
          </div>
        )}
      </div>
    </div>
  );
};
