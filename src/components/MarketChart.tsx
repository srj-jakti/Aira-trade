"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketChartProps {
  data: CandleData[];
  symbol?: string;
  support?: number;
  resistance?: number;
  isLoading?: boolean;
}

export function MarketChart({ data, symbol, support, resistance, isLoading }: MarketChartProps) {
  const chartData = useMemo(() => {
    return data.map((candle) => ({
      ...candle,
      date: new Date(candle.timestamp).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
      time: new Date(candle.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      range: [candle.low, candle.high],
      isGreen: candle.close >= candle.open,
    }));
  }, [data]);

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (data.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    const lows = data.map((d) => d.low);
    const highs = data.map((d) => d.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.1;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      priceRange: max - min,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/40">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          <span className="text-white/50 text-sm">Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/40 text-white/30 text-sm">
        Select an instrument to view price chart
      </div>
    );
  }

  const formatPrice = (value: number) => {
    if (value >= 10000) return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
    return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="w-full h-full bg-black/40 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.3)"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            stroke="rgba(255,255,255,0.3)"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
            tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={formatPrice}
            orientation="right"
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                close: "Close",
                open: "Open",
                high: "High",
                low: "Low",
                volume: "Volume",
              };
              return [formatPrice(value), labels[name] || name];
            }}
          />
          
          {support && (
            <ReferenceLine
              y={support}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={{
                value: `Support: ${formatPrice(support)}`,
                fill: "#22c55e",
                fontSize: 10,
                position: "left",
              }}
            />
          )}
          
          {resistance && (
            <ReferenceLine
              y={resistance}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: `Resistance: ${formatPrice(resistance)}`,
                fill: "#ef4444",
                fontSize: 10,
                position: "left",
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="close"
            stroke="transparent"
            fill="url(#priceGradient)"
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
