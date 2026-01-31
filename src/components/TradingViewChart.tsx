"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { 
  calculateBollingerBands, 
  calculateVWAP, 
  calculateSupertrend, 
  calculateSMA, 
  calculateEMA, 
  calculateRSI,
  calculateMACD,
  Candle 
} from "@/lib/indicators";

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
  type: "sma" | "ema" | "bollinger" | "vwap" | "supertrend" | "support_resistance" | "rsi" | "macd" | "stochastic" | "atr";
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
  showVolume?: boolean;
  lastPrice?: number | null;
  tick?: import("@/hooks/use-realtime-ticks").RealtimeTick | null;
  predictivePath?: { time: string; price: number }[];
  swingPoints?: { time: string; price: number; type: "HIGH" | "LOW" }[];
}

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
    onTimeframeChange: _onTimeframeChange,
    indicators = [],
    className,
    showVolume = false,
    lastPrice,
    tick,
    predictivePath,
    swingPoints,
  }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const predictiveSeriesRef = useRef<any>(null);
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
  const { resolvedTheme } = useTheme();

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
          visible: showVolume,
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
        } catch (_e) {
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

  // Update predictive path and swing points
  useEffect(() => {
    if (!chartReady || !chartInstanceRef.current || !predictiveSeriesRef.current || !candleSeriesRef.current) return;

    if (predictivePath && predictivePath.length > 0) {
      const lineData = predictivePath.map(p => ({
        time: (new Date(p.time).getTime() / 1000) as import("lightweight-charts").Time,
        value: p.price
      }));
      // Ensure timestamps are unique and ascending relative to existing data?
      // Lightweight charts requires strictly ascending time.
      // We assume predictivePath is strictly after the last candle or sorted correctly.
      try {
        predictiveSeriesRef.current.setData(lineData);
      } catch (e) {
        console.warn("Failed to set predictive data", e);
      }
    } else {
      predictiveSeriesRef.current.setData([]);
    }

    if (swingPoints && swingPoints.length > 0) {
      // @ts-ignore - markers type is correct but TS might complain about string literals
      const markers = swingPoints.map(p => ({
        time: (new Date(p.time).getTime() / 1000) as import("lightweight-charts").Time,
        position: (p.type === "HIGH" ? "aboveBar" : "belowBar") as "aboveBar" | "belowBar",
        color: p.type === "HIGH" ? "#ef4444" : "#22c55e",
        shape: (p.type === "HIGH" ? "arrowDown" : "arrowUp") as "arrowDown" | "arrowUp",
        text: p.type === "HIGH" ? "SH" : "SL",
      }));
      
      // We need to cast markers to the correct SeriesMarker type expected by lightweight-charts
      // The library expects an array of SeriesMarker<Time>
      candleSeriesRef.current.setMarkers(markers as import("lightweight-charts").SeriesMarker<import("lightweight-charts").Time>[]);
    } else {
      candleSeriesRef.current.setMarkers([]);
    }
  }, [predictivePath, swingPoints, chartReady]);

  // Update indicators
  useEffect(() => {
    if (!chartReady || !chartInstanceRef.current || !data || data.length === 0) return;

    const updateIndicators = async () => {
      try {
        const { LineSeries, HistogramSeries } = await import("lightweight-charts");
        
        // Remove old indicator series
        indicatorSeriesRef.current.forEach((series) => {
          if (chartInstanceRef.current) {
            try {
              if (Array.isArray(series)) {
                series.forEach(s => chartInstanceRef.current.removeSeries(s));
              } else {
                chartInstanceRef.current.removeSeries(series);
              }
            } catch (_e) {
              // Ignore removal errors
            }
          }
        });
        indicatorSeriesRef.current.clear();

        // Deduplicate and sort data
        const sortedData = deduplicateAndSortCandles(data);

        if (sortedData.length === 0) return;

        // Prepare data for calculators (convert timestamp string to seconds number)
        const calcData: Candle[] = [];
        for (const d of sortedData) {
          const t = Math.floor(new Date(d.timestamp).getTime() / 1000);
          if (!isNaN(t)) {
            calcData.push({
              time: t,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
              volume: d.volume || 0
            });
          }
        }

        if (calcData.length === 0) return;

        indicators.filter(ind => ind.visible).forEach((indicator) => {
          if (!chartInstanceRef.current) return;

          const color = indicator.color || "#f59e0b";

          if (indicator.type === "sma") {
            const period = indicator.params?.period ?? 20;
            const res = calculateSMA(calcData, period);
            const lineData = res.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.value }));
            
            if (lineData.length > 0) {
              const series = chartInstanceRef.current.addSeries(LineSeries, { color, lineWidth: 1.5, title: indicator.name });
              series.setData(lineData);
              indicatorSeriesRef.current.set(indicator.id, series);
            }
          } 
          else if (indicator.type === "ema") {
            const period = indicator.params?.period ?? 20;
            const res = calculateEMA(calcData, period);
            const lineData = res.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.value }));
            
            if (lineData.length > 0) {
              const series = chartInstanceRef.current.addSeries(LineSeries, { color, lineWidth: 1.5, title: indicator.name });
              series.setData(lineData);
              indicatorSeriesRef.current.set(indicator.id, series);
            }
          }
          else if (indicator.type === "bollinger") {
            const period = indicator.params?.period ?? 20;
            const stdDev = indicator.params?.stdDev ?? 2;
            const { upper, lower, basis } = calculateBollingerBands(calcData, period, stdDev);
            
            const upperData = upper.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.value }));
            const lowerData = lower.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.value }));
            const basisData = basis.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.value }));

            if (upperData.length > 0) {
              const s1 = chartInstanceRef.current.addSeries(LineSeries, { color, lineWidth: 1, title: `${indicator.name} Upper` });
              const s2 = chartInstanceRef.current.addSeries(LineSeries, { color, lineWidth: 1, title: `${indicator.name} Lower` });
              const s3 = chartInstanceRef.current.addSeries(LineSeries, { color: color, lineWidth: 1, lineStyle: 2, title: `${indicator.name} Basis` }); // Dashed basis
              
              s1.setData(upperData);
              s2.setData(lowerData);
              s3.setData(basisData);
              
              indicatorSeriesRef.current.set(indicator.id, [s1, s2, s3]);
            }
          }
          else if (indicator.type === "vwap") {
             const res = calculateVWAP(calcData);
             const lineData = res.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.value }));
             if (lineData.length > 0) {
               const series = chartInstanceRef.current.addSeries(LineSeries, { color, lineWidth: 1.5, title: indicator.name });
               series.setData(lineData);
               indicatorSeriesRef.current.set(indicator.id, series);
             }
          }
          else if (indicator.type === "supertrend") {
            const period = indicator.params?.period ?? 10;
            const multiplier = indicator.params?.multiplier ?? 3;
            const res = calculateSupertrend(calcData, period, multiplier);
            
            const upData = [];
            const downData = [];
            
            for (const p of res) {
                if (p.direction === 1) {
                    upData.push({ time: p.time as import("lightweight-charts").Time, value: p.value });
                    downData.push({ time: p.time as import("lightweight-charts").Time, value: NaN }); // Gap
                } else {
                    downData.push({ time: p.time as import("lightweight-charts").Time, value: p.value });
                    upData.push({ time: p.time as import("lightweight-charts").Time, value: NaN }); // Gap
                }
            }
            
            const sUp = chartInstanceRef.current.addSeries(LineSeries, { color: "#22c55e", lineWidth: 2, title: `${indicator.name} Up` });
            const sDown = chartInstanceRef.current.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, title: `${indicator.name} Down` });
            
            sUp.setData(upData);
            sDown.setData(downData);
            
            indicatorSeriesRef.current.set(indicator.id, [sUp, sDown]);
          }
          // --- NEW INDICATORS ---
          else if (indicator.type === "rsi") {
             // RSI needs a separate pane? Lightweight charts supports multiple panes but via multiple chart instances or custom logic.
             // For simplicity in this single-chart component, we might need to overlay or handle separately.
             // However, proper implementation usually requires a separate container.
             // Given the current architecture, we will overlay it scaled 0-100 on separate scale or just warn.
             // BETTER APPROACH: Add it to a new price scale on the left or separate pane.
             // Let's add it to a separate left price scale for now to avoid messing up price action.
             
             const period = indicator.params?.period ?? 14;
             const res = calculateRSI(calcData, period);
             const lineData = res.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.value }));
             
             if (lineData.length > 0) {
                const series = chartInstanceRef.current.addSeries(LineSeries, { 
                  color: indicator.color || "#8b5cf6", 
                  lineWidth: 1.5,
                  title: indicator.name,
                  priceScaleId: 'left', // Use left scale for oscillators
                  priceFormat: { type: 'price', precision: 1, minMove: 0.1 }
                });
                series.setData(lineData);
                
                // Add 70/30 lines for reference?
                series.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
                series.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });

                chartInstanceRef.current.priceScale('left').applyOptions({
                    visible: true,
                    autoScale: false,
                    scaleMargins: { top: 0.7, bottom: 0 }, // Place at bottom 30%
                });
                
                // Adjust main price scale to not overlap
                chartInstanceRef.current.priceScale('right').applyOptions({
                    scaleMargins: { top: 0.1, bottom: 0.35 }, // Main chart takes top 65%
                });

                indicatorSeriesRef.current.set(indicator.id, series);
             }
          }
          else if (indicator.type === "macd") {
             const fast = indicator.params?.fast ?? 12;
             const slow = indicator.params?.slow ?? 26;
             const signal = indicator.params?.signal ?? 9;
             const res = calculateMACD(calcData, fast, slow, signal);
             
             const macdData = res.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.macd }));
             const signalData = res.map(p => ({ time: p.time as import("lightweight-charts").Time, value: p.signal }));
             const histData = res.map(p => ({ 
                 time: p.time as import("lightweight-charts").Time, 
                 value: p.histogram,
                 color: p.histogram >= 0 ? '#22c55e' : '#ef4444'
             }));

             if (macdData.length > 0) {
                 // Using left scale for MACD too, overlapping with RSI if both present (simple implementation)
                 const macdSeries = chartInstanceRef.current.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'MACD', priceScaleId: 'left' });
                 const signalSeries = chartInstanceRef.current.addSeries(LineSeries, { color: '#f97316', lineWidth: 1, title: 'Signal', priceScaleId: 'left' });
                 const histSeries = chartInstanceRef.current.addSeries(HistogramSeries, { color: '#22c55e', title: 'Hist', priceScaleId: 'left' });

                 macdSeries.setData(macdData);
                 signalSeries.setData(signalData);
                 histSeries.setData(histData);

                 chartInstanceRef.current.priceScale('left').applyOptions({
                    visible: true,
                    scaleMargins: { top: 0.75, bottom: 0 },
                 });
                 chartInstanceRef.current.priceScale('right').applyOptions({
                    scaleMargins: { top: 0.1, bottom: 0.3 },
                 });

                 indicatorSeriesRef.current.set(indicator.id, [macdSeries, signalSeries, histSeries]);
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
