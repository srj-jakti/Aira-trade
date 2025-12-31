"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  CrosshairMode,
  LineStyle,
  ColorType,
} from "lightweight-charts";
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

function calculateSMA(data: CandleData[], period: number): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: Math.floor(new Date(data[i].timestamp).getTime() / 1000) as Time,
      value: sum / period,
    });
  }
  return result;
}

function calculateEMA(data: CandleData[], period: number): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
  
  for (let i = period - 1; i < data.length; i++) {
    if (i === period - 1) {
      result.push({
        time: Math.floor(new Date(data[i].timestamp).getTime() / 1000) as Time,
        value: ema,
      });
    } else {
      ema = data[i].close * k + ema * (1 - k);
      result.push({
        time: Math.floor(new Date(data[i].timestamp).getTime() / 1000) as Time,
        value: ema,
      });
    }
  }
  return result;
}

function calculateBollingerBands(data: CandleData[], period: number = 20, stdDev: number = 2) {
  const upper: { time: Time; value: number }[] = [];
  const middle: { time: Time; value: number }[] = [];
  const lower: { time: Time; value: number }[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
    const variance = slice.reduce((sum, d) => sum + Math.pow(d.close - avg, 2), 0) / period;
    const std = Math.sqrt(variance);
    const time = Math.floor(new Date(data[i].timestamp).getTime() / 1000) as Time;
    
    upper.push({ time, value: avg + stdDev * std });
    middle.push({ time, value: avg });
    lower.push({ time, value: avg - stdDev * std });
  }
  
  return { upper, middle, lower };
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
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const [ohlcData, setOhlcData] = useState<{ o: number; h: number; l: number; c: number; time: string } | null>(null);

  const formatPrice = useCallback((price: number) => {
    if (price >= 10000) return price.toLocaleString("en-IN", { maximumFractionDigits: 0 });
    return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
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
      handleScale: {
        axisPressedMouseMove: true,
      },
      handleScroll: {
        vertTouchDrag: true,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: "#3b82f6",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.get(candleSeries)) {
        const d = param.seriesData.get(candleSeries) as CandlestickData;
        setOhlcData({
          o: d.open,
          h: d.high,
          l: d.low,
          c: d.close,
          time: new Date((param.time as number) * 1000).toLocaleString("en-IN"),
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    const candleData: CandlestickData[] = data.map((d) => ({
      time: Math.floor(new Date(d.timestamp).getTime() / 1000) as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = data.map((d) => ({
      time: Math.floor(new Date(d.timestamp).getTime() / 1000) as Time,
      value: d.volume,
      color: d.close >= d.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    if (support) {
      candleSeriesRef.current.createPriceLine({
        price: support,
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Support",
      });
    }

    if (resistance) {
      candleSeriesRef.current.createPriceLine({
        price: resistance,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Resistance",
      });
    }

    chartRef.current.timeScale().fitContent();
  }, [data, support, resistance]);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    indicatorSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    indicatorSeriesRef.current.clear();

    indicators.filter(ind => ind.visible).forEach((indicator) => {
      let lineData: { time: Time; value: number }[] = [];
      const color = indicator.color || "#f59e0b";

      switch (indicator.type) {
        case "sma": {
          const period = indicator.params?.period || 20;
          lineData = calculateSMA(data, period);
          break;
        }
        case "ema": {
          const period = indicator.params?.period || 20;
          lineData = calculateEMA(data, period);
          break;
        }
        case "bollinger": {
          const period = indicator.params?.period || 20;
          const stdDev = indicator.params?.stdDev || 2;
          const bands = calculateBollingerBands(data, period, stdDev);
          
          const upperSeries = chartRef.current!.addLineSeries({
            color: "rgba(147, 51, 234, 0.5)",
            lineWidth: 1,
            title: "BB Upper",
          });
          upperSeries.setData(bands.upper);
          indicatorSeriesRef.current.set(`${indicator.id}_upper`, upperSeries);
          
          const middleSeries = chartRef.current!.addLineSeries({
            color: "rgba(147, 51, 234, 0.8)",
            lineWidth: 1,
            title: "BB Middle",
          });
          middleSeries.setData(bands.middle);
          indicatorSeriesRef.current.set(`${indicator.id}_middle`, middleSeries);
          
          const lowerSeries = chartRef.current!.addLineSeries({
            color: "rgba(147, 51, 234, 0.5)",
            lineWidth: 1,
            title: "BB Lower",
          });
          lowerSeries.setData(bands.lower);
          indicatorSeriesRef.current.set(`${indicator.id}_lower`, lowerSeries);
          return;
        }
      }

      if (lineData.length > 0) {
        const series = chartRef.current!.addLineSeries({
          color,
          lineWidth: 2,
          title: indicator.name,
        });
        series.setData(lineData);
        indicatorSeriesRef.current.set(indicator.id, series);
      }
    });
  }, [indicators, data]);

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

  if (data.length === 0) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center bg-black/40 text-white/30 text-sm", className)}>
        Select an instrument to view chart
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full flex flex-col bg-black/40", className)}>
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
    </div>
  );
}
