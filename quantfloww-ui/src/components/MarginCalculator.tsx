import React, { useState, useEffect } from 'react';
import { ShieldAlert, HelpCircle } from 'lucide-react';

interface MarginCalculatorProps {
  currentPrice: number;
}

export const MarginCalculator: React.FC<MarginCalculatorProps> = ({ currentPrice }) => {
  const [leverage, setLeverage] = useState<number>(5); // Default 5x leverage
  const [shares, setShares] = useState<number>(100); // Default 100 shares
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice);
  const [exitPrice, setExitPrice] = useState<number>(currentPrice);

  // Sync entry/exit prices if current price changes initially
  useEffect(() => {
    setEntryPrice(currentPrice);
    setExitPrice(currentPrice);
  }, [currentPrice]);

  // Calculations
  const positionValue = entryPrice * shares;
  const marginRequired = positionValue / leverage;
  
  // Liquidation Price calculation assuming 10% maintenance margin
  const maintenanceMarginRate = 0.10;
  const estLiquidationPrice = entryPrice * (1 - (1 - maintenanceMarginRate) / leverage);

  const profitLoss = (exitPrice - entryPrice) * shares;
  const returnOnMargin = marginRequired > 0 ? (profitLoss / marginRequired) * 100 : 0;

  return (
    <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-blue-500" />
          Margin & Leverage Calculator
        </h3>
        <p className="text-xs text-zinc-450 dark:text-zinc-550">
          Analyze trade exposure, margins, and liquidation risk.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Left Side: Inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Leverage Multiplier ({leverage}x)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[9px] font-mono text-zinc-400">
              <span>1x (Spot)</span>
              <span>5x</span>
              <span>10x (Max)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Position (Shares)
              </label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Entry Price (₹)
              </label>
              <input
                type="number"
                step="0.05"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Math.max(0.05, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Target Exit Price (₹)
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                {(((exitPrice - entryPrice) / entryPrice) * 100).toFixed(1)}% price move
              </span>
            </div>
            <input
              type="number"
              step="0.05"
              value={exitPrice}
              onChange={(e) => setExitPrice(Math.max(0.05, Number(e.target.value)))}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Right Side: Risk Outputs */}
        <div className="bg-zinc-50 dark:bg-[#09090b]/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-4">
          
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-zinc-550 dark:text-zinc-450">Total Position Value</span>
              <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                ₹{positionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[11px] text-zinc-550 dark:text-zinc-450">Margin Required</span>
              <span className="font-mono text-xs font-black text-blue-500">
                ₹{marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800/80 pt-3">
              <span className="text-[11px] text-zinc-550 dark:text-zinc-450 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                Est. Liquidation Price
              </span>
              <span className="font-mono text-xs font-black text-rose-500">
                ₹{estLiquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bg-zinc-100 dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Projected P&L</span>
              <span className={`font-mono text-xs font-black ${profitLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {profitLoss >= 0 ? '+' : ''}₹{profitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Return on Margin</span>
              <span className={`font-mono text-xs font-black ${returnOnMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {returnOnMargin >= 0 ? '+' : ''}{returnOnMargin.toFixed(1)}%
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
