"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

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
  lastPrice?: number | null;
  tick?: import("@/hooks/use-realtime-ticks").RealtimeTick | null;
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

/**
 * Deduplicate and sort candle data by timestamp
 * TradingView Lightweight Charts requires unique, ascending timestamps
 */
function deduplicateAndSortCandles(data: CandleData[]): CandleData[] {
  if (!data || data.length === 0) return [];
  
  // Create a map to deduplicate by timestamp (keep the latest entry for each timestamp)
  const candleMap = new Map<number, CandleData>();
  
  for (const candle of data) {
    if (!candle || !candle.timestamp) continue;
    const timestamp = Math.floor(new Date(candle.timestamp).getTime() / 1000);
    if (!isNaN(timestamp)) {
      // Keep the latest candle for each timestamp (overwrites previous)
      candleMap.set(timestamp, candle);
    }
  }
  
  // Convert back to array and sort by timestamp ascending
  return Array.from(candleMap.values()).sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

  export function TradingViewChart({
    data,
    symbol,
    support,
    resistance,
    isLoading,
    timeframe,
    onTimeframeChange,
    indicators = [],
    className,
    lastPrice,
    tick,
  }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const indicatorSeriesRef = useRef<Map<string, any>>(new Map());
  const [ohlcData, setOhlcData] = useState<{ o: number; h: number; l: number; c: number; time: string } | null>(null);
    const [chartReady, setChartReady] = useState(false);
    const [countdown, setCountdown] = useState<string>("");
    const isFirstLoadRef = useRef(true);

    // Reset first load when symbol or timeframe changes
    useEffect(() => {
      isFirstLoadRef.current = true;
    }, [symbol, timeframe]);

    // Memoize sorted data to prevent expensive recalculations

  const sortedData = useMemo(() => deduplicateAndSortCandles(data), [data]);

  const formatPrice = useCallback((price: number) => {
    if (price === undefined || price === null) return "0.00";
    if (price >= 10000) return price.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  const formatTime = useCallback((utcTimestamp: number) => {
    const date = new Date(utcTimestamp * 1000);
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, []);

  // Real-time countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (!timeframe) return;
      
      const timeframeSeconds: Record<string, number> = {
        "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800
      };
      const seconds = timeframeSeconds[timeframe] || 60;
      
      const now = Date.now();
      const nextCandleTime = Math.ceil(now / (seconds * 1000)) * (seconds * 1000);
      const diff = Math.max(0, nextCandleTime - now);
      
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      
      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${secs}s`);
      } else {
        setCountdown(`${minutes}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeframe]);

  // Initialize chart
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const initChart = async () => {
      try {
        const { createChart, CrosshairMode, ColorType, CandlestickSeries, HistogramSeries } = await import("lightweight-charts");

        if (!mounted || !chartContainerRef.current) return;

        const isDark = resolvedTheme === "dark";
        const backgroundColor = isDark ? "#0a0a0a" : "#ffffff";
        const textColor = isDark ? "#d1d5db" : "#374151";
        const gridColor = isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.05)";
        const crosshairColor = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)";
        const labelBg = isDark ? "#1f2937" : "#e5e7eb";
        const borderColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";

        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          layout: {
            background: { type: ColorType.Solid, color: backgroundColor },
            textColor: textColor,
            fontSize: 12,
            fontFamily: "Inter, sans-serif",
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: crosshairColor,
              labelBackgroundColor: labelBg,
              width: 1,
              style: 3,
            },
            horzLine: {
              color: crosshairColor,
              labelBackgroundColor: labelBg,
              width: 1,
              style: 3,
            },
          },
            rightPriceScale: {
              borderColor: borderColor,
              scaleMargins: { top: 0.1, bottom: 0.2 },
              autoScale: true,
              alignLabels: true,
            },
            timeScale: {
              borderColor: borderColor,
              timeVisible: true,
              secondsVisible: false,
              rightOffset: 30,
              barSpacing: 20,
              minBarSpacing: 8,

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

        if (!mounted) {
          chart.remove();
          return;
        }

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
                time: formatTime(param.time as number),
              });
            }
          }
        });

        resizeObserver = new ResizeObserver((entries) => {
          if (entries.length === 0 || !chartContainerRef.current || !mounted) return;
          const { width, height } = entries[0].contentRect;
          if (chartInstanceRef.current) {
            chartInstanceRef.current.applyOptions({ width, height });
          }
        });

        resizeObserver.observe(chartContainerRef.current);
        
        if (mounted) {
          setChartReady(true);
        }
      } catch (error) {
        console.error("[TradingViewChart] Error initializing chart:", error);
      }
    };

    initChart();

    return () => {
      mounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        indicatorSeriesRef.current.clear();
      }
      setChartReady(false);
    };
  }, [formatTime, resolvedTheme]);

    // Update chart data when data changes
    useEffect(() => {
      if (!chartReady || !chartInstanceRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) {
        return;
      }
      
      if (!sortedData || sortedData.length === 0) {
        candleSeriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
        return;
      }

      try {
        const candleData = sortedData.map((d) => ({
          time: (new Date(d.timestamp).getTime() / 1000) as import("lightweight-charts").Time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));

        const volumeData = sortedData.map((d) => ({
          time: (new Date(d.timestamp).getTime() / 1000) as import("lightweight-charts").Time,
          value: d.volume || 0,
          color: d.close >= d.open ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
        }));

        candleSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);

        if (isFirstLoadRef.current) {
          chartInstanceRef.current.timeScale().fitContent();
          isFirstLoadRef.current = false;
        }
      } catch (error) {
        console.error("[TradingViewChart] Error setting data:", error);
      }
    }, [sortedData, chartReady]);

  // Add support/resistance price lines
  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current || !chartInstanceRef.current) return;

    const addPriceLines = async () => {
      try {
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
      } catch (error) {
        console.error("[TradingViewChart] Error adding price lines:", error);
      }
    };

    addPriceLines();
  }, [support, resistance, chartReady]);

  // Update indicators
  useEffect(() => {
    if (!chartReady || !chartInstanceRef.current || !data || data.length === 0) return;

    const updateIndicators = async () => {
      try {
        const { LineSeries } = await import("lightweight-charts");
        
        // Remove old indicator series
        indicatorSeriesRef.current.forEach((series) => {
          if (chartInstanceRef.current) {
            try {
              chartInstanceRef.current.removeSeries(series);
            } catch (e) {
              // Ignore removal errors
            }
          }
        });
        indicatorSeriesRef.current.clear();

        // Deduplicate and sort data
        const sortedData = deduplicateAndSortCandles(data);

        if (sortedData.length === 0) return;

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
                  time: (new Date(sortedData[i].timestamp).getTime() / 1000) as import("lightweight-charts").Time,
                  value: sum / period,
                });
              }
            } else {
              const k = 2 / (period + 1);
              let ema = sortedData.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
              
              for (let i = period - 1; i < sortedData.length; i++) {
                if (i === period - 1) {
                  lineData.push({
                    time: (new Date(sortedData[i].timestamp).getTime() / 1000) as import("lightweight-charts").Time,
                    value: ema,
                  });
                } else {
                  ema = sortedData[i].close * k + ema * (1 - k);
                  lineData.push({
                    time: (new Date(sortedData[i].timestamp).getTime() / 1000) as import("lightweight-charts").Time,
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
      } catch (error) {
        console.error("[TradingViewChart] Error updating indicators:", error);
      }
    };

    updateIndicators();
  }, [indicators, data, chartReady]);

  // Update last candle with real-time price
  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current || lastPrice === null || lastPrice === undefined) {
      return;
    }

    const timeframeSeconds: Record<string, number> = {
      "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800
    };
    const seconds = timeframeSeconds[timeframe] || 60;

    try {
      // Use tick timestamp if available, otherwise fallback to now
      const tickTime = tick?.tick_timestamp ? new Date(tick.tick_timestamp).getTime() : Date.now();
      const bucketStart = Math.floor(tickTime / (seconds * 1000)) * (seconds * 1000) / 1000;

      // Find the last known data point to base our open/high/low on
      const lastDataPoint = sortedData[sortedData.length - 1];
      
      let baseOpen = lastPrice;
      let baseHigh = lastPrice;
      let baseLow = lastPrice;

      if (lastDataPoint) {
        const lastDataTime = new Date(lastDataPoint.timestamp).getTime() / 1000;
        // If we are still in the same candle as the last data point
        if (bucketStart === lastDataTime) {
          baseOpen = lastDataPoint.open;
          baseHigh = Math.max(lastDataPoint.high, lastPrice);
          baseLow = Math.min(lastDataPoint.low, lastPrice);
        }
      }

      const lastCandle = {
        time: bucketStart as import("lightweight-charts").Time,
        open: baseOpen,
        high: baseHigh,
        low: baseLow,
        close: lastPrice,
      };

      candleSeriesRef.current.update(lastCandle);
      
      // Update OHLC display if not hovering
      if (!ohlcData || ohlcData.time === formatTime(bucketStart)) {
        setOhlcData({
          o: baseOpen,
          h: baseHigh,
          l: baseLow,
          c: lastPrice,
          time: formatTime(bucketStart),
        });
      }
    } catch (error) {
      console.error("[TradingViewChart] Error updating real-time price:", error);
    }
  }, [lastPrice, tick, chartReady, timeframe, sortedData, formatTime]);

  const { theme } = useTheme();
  
  return (
    <div className={cn("w-full h-full flex flex-col relative bg-card", className)}>
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-muted-foreground text-sm font-medium">Loading market data...</span>
          </div>
        </div>
      )}

        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card/5 backdrop-blur-md z-10 min-h-[40px]">
          {ohlcData ? (
            <div className="flex items-center gap-4 text-[11px] font-mono w-full justify-between">
              <div className="flex flex-col">
                <span className="text-muted-foreground hidden sm:inline">{ohlcData.time}</span>
                <span className="text-[10px] text-blue-500 font-bold">NEXT: {countdown}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="text-muted-foreground">O</span> <span className="text-foreground">{formatPrice(ohlcData.o)}</span></span>
                <span className="flex items-center gap-1"><span className="text-muted-foreground">H</span> <span className="text-green-500">{formatPrice(ohlcData.h)}</span></span>
                <span className="flex items-center gap-1"><span className="text-muted-foreground">L</span> <span className="text-red-500">{formatPrice(ohlcData.l)}</span></span>
                <span className="flex items-center gap-1"><span className="text-muted-foreground">C</span> <span className={ohlcData.c >= ohlcData.o ? "text-green-500" : "text-red-500"}>{formatPrice(ohlcData.c)}</span></span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {symbol} • {timeframe}
              </div>
              <div className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">
                NEXT: {countdown}
              </div>
            </div>
          )}
        </div>
      
      <div ref={chartContainerRef} className="flex-1 min-h-0 w-full" />
      
      {(!data || data.length === 0) && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 text-muted-foreground text-sm pointer-events-none italic">
          No data available for the selected timeframe
        </div>
      )}
    </div>
  );
}
