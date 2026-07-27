import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts';
import { Activity, BarChart2 } from 'lucide-react';

interface StockChartProps {
  data: Array<{
    date: string; // "YYYY-MM-DD"
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  symbol: string;
  theme: 'dark' | 'light';
}

export const StockChart: React.FC<StockChartProps> = ({ data, symbol, theme }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Premium Color Configs
    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0c0c0f' : '#ffffff';
    const textColor = isDark ? '#d4d4d8' : '#18181b';
    const gridColor = isDark ? '#1e1e24' : '#e4e4e7';
    const primaryAccent = '#3b82f6'; // Blue

    // Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: bgColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
      timeScale: {
        borderColor: gridColor,
      },
    });

    chartRef.current = chart;

    // Handle Window Resizing
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // Populate Data based on chartType
    if (chartType === 'candle') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      const formattedData: CandlestickData[] = data.map(item => ({
        time: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

      candleSeries.setData(formattedData);
      candleSeriesRef.current = candleSeries;
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: primaryAccent,
        lineWidth: 2,
      });

      const formattedData: LineData[] = data.map(item => ({
        time: item.date,
        value: item.close,
      }));

      lineSeries.setData(formattedData);
      lineSeriesRef.current = lineSeries;
    }

    // Fit content
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
    };
  }, [data, chartType, theme]);

  return (
    <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Interactive Chart
          </span>
          <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{symbol} Performance</h3>
        </div>

        {/* Chart Type Toggle Buttons */}
        <div className="flex bg-zinc-100 dark:bg-[#18181b] p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setChartType('candle')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              chartType === 'candle'
                ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Candles
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              chartType === 'line'
                ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Line
          </button>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full relative" />
    </div>
  );
};
