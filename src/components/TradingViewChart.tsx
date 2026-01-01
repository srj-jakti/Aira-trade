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
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "rgba(255, 255, 255, 0.5)",
        },
        grid: {
          vertLines: { color: "rgba(255, 255, 255, 0.05)" },
          horzLines: { color: "rgba(255, 255, 255, 0.05)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: "rgba(255, 255, 255, 0.3)",
            labelBackgroundColor: "#1f2937",
          },
          horzLine: {
            color: "rgba(255, 255, 255, 0.3)",
            labelBackgroundColor: "#1f2937",
          },
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartInstanceRef.current = chart;

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      candleSeriesRef.current = candleSeries;

      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "#3b82f6",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
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
              time: new Date((param.time as number) * 1000).toLocaleString("en-IN"),
            });
          }
        }
      });

      setChartReady(true);
    };

    initChart();

    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
      setChartReady(false);
    };
  }, []);

  useEffect(() => {
    if (!chartReady || !chartInstanceRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (data.length === 0) return;

    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const candleData = sortedData.map((d) => ({
      time: Math.floor(new Date(d.timestamp).getTime() / 1000) as import("lightweight-charts").Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = sortedData.map((d) => ({
      time: Math.floor(new Date(d.timestamp).getTime() / 1000) as import("lightweight-charts").Time,
      value: d.volume,
      color: d.close >= d.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    chartInstanceRef.current.timeScale().fitContent();
  }, [data, chartReady]);

  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current || !chartInstanceRef.current) return;

    const addPriceLines = async () => {
      const { LineStyle } = await import("lightweight-charts");
      
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

    const addIndicators = async () => {
      const { LineSeries } = await import("lightweight-charts");
      
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
                time: Math.floor(new Date(sortedData[i].timestamp).getTime() / 1000) as import("lightweight-charts").Time,
                value: sum / period,
              });
            }
          } else {
            const k = 2 / (period + 1);
            let ema = sortedData.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
            
            for (let i = period - 1; i < sortedData.length; i++) {
              if (i === period - 1) {
                lineData.push({
                  time: Math.floor(new Date(sortedData[i].timestamp).getTime() / 1000) as import("lightweight-charts").Time,
                  value: ema,
                });
              } else {
                ema = sortedData[i].close * k + ema * (1 - k);
                lineData.push({
                  time: Math.floor(new Date(sortedData[i].timestamp).getTime() / 1000) as import("lightweight-charts").Time,
                  value: ema,
                });
              }
            }
          }

          if (lineData.length > 0 && chartInstanceRef.current) {
            const series = chartInstanceRef.current.addSeries(LineSeries, {
              color,
              lineWidth: 2,
              title: indicator.name,
            });
            series.setData(lineData);
          }
        }
      });
    };

    addIndicators();
  }, [indicators, data, chartReady]);

  if (isLoading) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center bg-black/40", className)}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          <span className="text-white/50 text-sm">Loading chart...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full flex flex-col bg-black/40 relative", className)}>
      <div className="flex items-center justify-between p-2 border-b border-white/5">
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                timeframe === tf.value
                  ? "bg-blue-500/20 text-blue-400 font-medium"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
        
        {ohlcData && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-white/40">{ohlcData.time}</span>
            <span className="text-white/60">O: <span className="text-white">{formatPrice(ohlcData.o)}</span></span>
            <span className="text-white/60">H: <span className="text-green-400">{formatPrice(ohlcData.h)}</span></span>
            <span className="text-white/60">L: <span className="text-red-400">{formatPrice(ohlcData.l)}</span></span>
            <span className="text-white/60">C: <span className={ohlcData.c >= ohlcData.o ? "text-green-400" : "text-red-400"}>{formatPrice(ohlcData.c)}</span></span>
          </div>
        )}
      </div>
      
      <div ref={chartContainerRef} className="flex-1 min-h-0" />
      
      {data.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white/30 text-sm pointer-events-none">
          Select an instrument to view chart
        </div>
      )}
    </div>
  );
}
