"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorOverlay {
  id: string;
  name: string;
  type: "sma" | "ema" | "bollinger" | "support_resistance";
  params?: Record<string, number>;
  color?: string;
  visible: boolean;
}

interface TradingViewChartProps {
  data: CandleData[];
  symbol?: string;
  support?: number;
  resistance?: number;
  isLoading?: boolean;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  indicators?: IndicatorOverlay[];
  className?: string;
}

const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

const IST_OFFSET_SECONDS = 5.5 * 60 * 60;

function toISTTimestamp(dateStr: string): number {
  const date = new Date(dateStr);
  const utcSeconds = Math.floor(date.getTime() / 1000);
  return utcSeconds + IST_OFFSET_SECONDS;
}

function formatISTTime(utcTimestamp: number): string {
  const istDate = new Date((utcTimestamp + IST_OFFSET_SECONDS) * 1000);
  return istDate.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

type ChartApi = ReturnType<typeof import("lightweight-charts").createChart>;
type CandlestickSeriesApi = ReturnType<ChartApi["addSeries"]>;
type HistogramSeriesApi = ReturnType<ChartApi["addSeries"]>;

  export function TradingViewChart({
    data,
    support,
    resistance,
    isLoading,
    timeframe,
    onTimeframeChange,
    indicators = [],
    className,
  }: TradingViewChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<ChartApi | null>(null);
    const candleSeriesRef = useRef<CandlestickSeriesApi | null>(null);
    const volumeSeriesRef = useRef<HistogramSeriesApi | null>(null);
    const indicatorSeriesRef = useRef<Map<string, any>>(new Map());
    const [ohlcData, setOhlcData] = useState<{ o: number; h: number; l: number; c: number; time: string } | null>(null);
    const [chartReady, setChartReady] = useState(false);

    const formatPrice = useCallback((price: number) => {
      if (price >= 10000) return price.toLocaleString("en-IN", { maximumFractionDigits: 0 });
      return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, []);

    useEffect(() => {
      if (!chartContainerRef.current) return;

      const initChart = async () => {
        const { createChart, CrosshairMode, ColorType, CandlestickSeries, HistogramSeries } = await import("lightweight-charts");

        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          layout: {
            background: { type: ColorType.Solid, color: "#0a0a0a" },
            textColor: "#d1d5db",
            fontSize: 12,
            fontFamily: "Inter, sans-serif",
          },
          grid: {
            vertLines: { color: "rgba(255, 255, 255, 0.03)" },
            horzLines: { color: "rgba(255, 255, 255, 0.03)" },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: "rgba(255, 255, 255, 0.2)",
              labelBackgroundColor: "#1f2937",
              width: 1,
              style: 3,
            },
            horzLine: {
              color: "rgba(255, 255, 255, 0.2)",
              labelBackgroundColor: "#1f2937",
              width: 1,
              style: 3,
            },
          },
          rightPriceScale: {
            borderColor: "rgba(255, 255, 255, 0.1)",
            scaleMargins: { top: 0.1, bottom: 0.2 },
            autoScale: true,
            alignLabels: true,
          },
          timeScale: {
            borderColor: "rgba(255, 255, 255, 0.1)",
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 6,
            tickMarkFormatter: (time: number) => {
              const date = new Date(time * 1000);
              return date.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
            },
          },
          localization: {
            locale: "en-IN",
            dateFormat: "dd MMM yyyy",
            timeFormatter: (time: number) => {
              const date = new Date(time * 1000);
              return date.toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
            },
          },
          handleScroll: true,
          handleScale: true,
        });

        chartInstanceRef.current = chart;

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderUpColor: "#22c55e",
          borderDownColor: "#ef4444",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
          priceFormat: {
            type: "price",
            precision: 2,
            minMove: 0.05,
          },
        });
        candleSeriesRef.current = candleSeries;

        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: "#3b82f6",
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;

        chart.subscribeCrosshairMove((param) => {
          if (param.time && candleSeries) {
            const d = param.seriesData.get(candleSeries) as { open: number; high: number; low: number; close: number } | undefined;
            if (d) {
              setOhlcData({
                o: d.open,
                h: d.high,
                l: d.low,
                c: d.close,
                time: formatISTTime(param.time as number),
              });
            }
          }
        });

        const resizeObserver = new ResizeObserver((entries) => {
          if (entries.length === 0 || !chartContainerRef.current) return;
          const { width, height } = entries[0].contentRect;
          chart.applyOptions({ width, height });
        });

        resizeObserver.observe(chartContainerRef.current);
        setChartReady(true);

        return () => resizeObserver.disconnect();
      };

      const cleanup = initChart();

      return () => {
        cleanup.then(fn => fn?.());
        if (chartInstanceRef.current) {
          chartInstanceRef.current.remove();
          chartInstanceRef.current = null;
          candleSeriesRef.current = null;
          volumeSeriesRef.current = null;
          indicatorSeriesRef.current.clear();
        }
        setChartReady(false);
      };
    }, []);

    useEffect(() => {
      if (!chartReady || !chartInstanceRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
      if (data.length === 0) {
        candleSeriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
        return;
      }

      const sortedData = [...data].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const candleData = sortedData.map((d) => ({
        time: toISTTimestamp(d.timestamp) as import("lightweight-charts").Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const volumeData = sortedData.map((d) => ({
        time: toISTTimestamp(d.timestamp) as import("lightweight-charts").Time,
        value: d.volume,
        color: d.close >= d.open ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
      }));

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);

      chartInstanceRef.current.timeScale().fitContent();
    }, [data, chartReady]);

    useEffect(() => {
      if (!chartReady || !candleSeriesRef.current || !chartInstanceRef.current) return;

      const addPriceLines = async () => {
        const { LineStyle } = await import("lightweight-charts");
        
        // Clear existing price lines (workaround since there's no clearPriceLines)
        // Actually lightweight-charts price lines are persistent on the series.
        // We might want to track them if we were changing them often, but support/resistance are static per analysis.
        
        if (support && candleSeriesRef.current) {
          candleSeriesRef.current.createPriceLine({
            price: support,
            color: "#22c55e",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "Support",
          });
        }

        if (resistance && candleSeriesRef.current) {
          candleSeriesRef.current.createPriceLine({
            price: resistance,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "Resistance",
          });
        }
      };

      addPriceLines();
    }, [support, resistance, chartReady]);

    useEffect(() => {
      if (!chartReady || !chartInstanceRef.current || data.length === 0) return;

      const updateIndicators = async () => {
        const { LineSeries } = await import("lightweight-charts");
        
        // Remove old indicator series
        indicatorSeriesRef.current.forEach((series) => {
          if (chartInstanceRef.current) {
            chartInstanceRef.current.removeSeries(series);
          }
        });
        indicatorSeriesRef.current.clear();

        const sortedData = [...data].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        indicators.filter(ind => ind.visible).forEach((indicator) => {
          if (!chartInstanceRef.current) return;

          const color = indicator.color || "#f59e0b";

          if (indicator.type === "sma" || indicator.type === "ema") {
            const period = indicator.params?.period || 20;
            const lineData: { time: import("lightweight-charts").Time; value: number }[] = [];
            
            if (indicator.type === "sma") {
              for (let i = period - 1; i < sortedData.length; i++) {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                  sum += sortedData[i - j].close;
                }
                lineData.push({
                  time: toISTTimestamp(sortedData[i].timestamp) as import("lightweight-charts").Time,
                  value: sum / period,
                });
              }
            } else {
              const k = 2 / (period + 1);
              let ema = sortedData.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
              
              for (let i = period - 1; i < sortedData.length; i++) {
                if (i === period - 1) {
                  lineData.push({
                    time: toISTTimestamp(sortedData[i].timestamp) as import("lightweight-charts").Time,
                    value: ema,
                  });
                } else {
                  ema = sortedData[i].close * k + ema * (1 - k);
                  lineData.push({
                    time: toISTTimestamp(sortedData[i].timestamp) as import("lightweight-charts").Time,
                    value: ema,
                  });
                }
              }
            }

            if (lineData.length > 0 && chartInstanceRef.current) {
              const series = chartInstanceRef.current.addSeries(LineSeries, {
                color,
                lineWidth: 1.5,
                title: indicator.name,
              });
              series.setData(lineData);
              indicatorSeriesRef.current.set(indicator.id, series);
            }
          }
        });
      };

      updateIndicators();
    }, [indicators, data, chartReady]);

    return (
      <div className={cn("w-full h-full flex flex-col bg-[#0a0a0a] relative", className)}>
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-white/70 text-sm font-medium">Loading market data...</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5 backdrop-blur-md z-10">
          <div className="flex items-center gap-1.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-all",
                  timeframe === tf.value
                    ? "bg-blue-500/20 text-blue-400 font-semibold ring-1 ring-blue-500/30"
                    : "text-white/40 hover:text-white/70 hover:bg-white/10"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
          
          {ohlcData && (
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-white/30 hidden sm:inline">{ohlcData.time}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="text-white/40">O</span> <span className="text-white">{formatPrice(ohlcData.o)}</span></span>
                <span className="flex items-center gap-1"><span className="text-white/40">H</span> <span className="text-green-400">{formatPrice(ohlcData.h)}</span></span>
                <span className="flex items-center gap-1"><span className="text-white/40">L</span> <span className="text-red-400">{formatPrice(ohlcData.l)}</span></span>
                <span className="flex items-center gap-1"><span className="text-white/40">C</span> <span className={ohlcData.c >= ohlcData.o ? "text-green-400" : "text-red-400"}>{formatPrice(ohlcData.c)}</span></span>
              </div>
            </div>
          )}
        </div>
        
        <div ref={chartContainerRef} className="flex-1 min-h-0 w-full" />
        
        {data.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white/30 text-sm pointer-events-none italic">
            No data available for the selected timeframe
          </div>
        )}
      </div>
    );
  }

