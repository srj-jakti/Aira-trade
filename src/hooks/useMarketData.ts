"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";

export interface MarketTick {
  instrument_token: number;
  tradingsymbol?: string;
  last_price: number;
  change: number | null;
  change_percent: number | null;
  volume: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  oi: number | null;
  bid?: number;
  ask?: number;
  last_trade_time: string | null;
  tick_timestamp: string;
}

export interface MarketDataState {
  ticks: Map<number, MarketTick>;
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  error: string | null;
  lastUpdate: Date | null;
  subscribedCount: number;
}

interface UseMarketDataOptions {
  instrumentTokens?: number[];
  autoSubscribe?: boolean;
  enabled?: boolean;
  onTick?: (tick: MarketTick) => void;
  pollInterval?: number;
}

const globalTickCache = new Map<number, MarketTick>();

export function useMarketData(options: UseMarketDataOptions = {}) {
  const {
    instrumentTokens = [],
    enabled = true,
    onTick,
    pollInterval = 1000,
  } = options;

  const [state, setState] = useState<MarketDataState>({
    ticks: new Map(),
    isConnected: false,
    connectionStatus: "disconnected",
    error: null,
    lastUpdate: null,
    subscribedCount: 0,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const tokenSet = useMemo(() => new Set(instrumentTokens), [instrumentTokens]);

  const fetchQuotes = useCallback(async () => {
    if (isFetchingRef.current || instrumentTokens.length === 0) return;
    isFetchingRef.current = true;

    try {
      const response = await fetch(
        `/api/market-data/on-demand?instruments=${instrumentTokens.join(",")}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch quotes");
      }

      const data = await response.json();

      if (!data.success) {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          connectionStatus: "error",
          error: data.error || "Failed to fetch quotes",
        }));
        return;
      }

      const quotes = data.quotes || {};
      const newTicks = new Map<number, MarketTick>();

      for (const [tokenStr, quote] of Object.entries(quotes)) {
        const q = quote as {
          instrument_token: number;
          last_price: number;
          change: number;
          change_percent: number;
          volume: number;
          oi: number;
          open: number;
          high: number;
          low: number;
          close: number;
          bid: number;
          ask: number;
          timestamp: string;
        };

        const tick: MarketTick = {
          instrument_token: q.instrument_token,
          last_price: q.last_price,
          change: q.change,
          change_percent: q.change_percent,
          volume: q.volume,
          oi: q.oi,
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          bid: q.bid,
          ask: q.ask,
          last_trade_time: q.timestamp,
          tick_timestamp: q.timestamp,
        };

        newTicks.set(q.instrument_token, tick);
        globalTickCache.set(q.instrument_token, tick);

        onTick?.(tick);
      }

      setState((prev) => ({
        ...prev,
        ticks: newTicks,
        isConnected: true,
        connectionStatus: "connected",
        error: null,
        lastUpdate: new Date(),
        subscribedCount: newTicks.size,
      }));
    } catch (err) {
      console.error("[useMarketData] Fetch error:", err);
      setState((prev) => ({
        ...prev,
        connectionStatus: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [instrumentTokens, onTick]);

  useEffect(() => {
    if (!enabled || instrumentTokens.length === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        isConnected: false,
        connectionStatus: "disconnected",
      }));
      return;
    }

    setState((prev) => ({ ...prev, connectionStatus: "connecting" }));

    fetchQuotes();

    pollIntervalRef.current = setInterval(fetchQuotes, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enabled, instrumentTokens, fetchQuotes, pollInterval]);

  const getPrice = useCallback(
    (token: number): number | null => {
      return state.ticks.get(token)?.last_price ?? globalTickCache.get(token)?.last_price ?? null;
    },
    [state.ticks]
  );

  const getTick = useCallback(
    (token: number): MarketTick | null => {
      return state.ticks.get(token) ?? globalTickCache.get(token) ?? null;
    },
    [state.ticks]
  );

  const getAllTicks = useCallback((): MarketTick[] => {
    return Array.from(state.ticks.values());
  }, [state.ticks]);

  const getPriceChange = useCallback(
    (token: number): { change: number; changePercent: number } | null => {
      const tick = state.ticks.get(token) ?? globalTickCache.get(token);
      if (!tick) return null;
      return {
        change: tick.change ?? 0,
        changePercent: tick.change_percent ?? 0,
      };
    },
    [state.ticks]
  );

  return {
    ...state,
    getPrice,
    getTick,
    getAllTicks,
    getPriceChange,
  };
}

export function usePrice(instrumentToken: number, enabled = true) {
  const { getPrice, getTick, isConnected, error } = useMarketData({
    instrumentTokens: [instrumentToken],
    enabled,
    pollInterval: 1000,
  });

  return {
    price: getPrice(instrumentToken),
    tick: getTick(instrumentToken),
    isConnected,
    error,
  };
}

export function usePrices(instrumentTokens: number[], enabled = true) {
  const { ticks, isConnected, error, getPrice } = useMarketData({
    instrumentTokens,
    enabled,
    pollInterval: 1000,
  });

  const prices = useMemo(() => {
    const map = new Map<number, number>();
    instrumentTokens.forEach((token) => {
      const price = getPrice(token);
      if (price !== null) {
        map.set(token, price);
      }
    });
    return map;
  }, [ticks, instrumentTokens, getPrice]);

  return {
    prices,
    getPrice,
    isConnected,
    error,
  };
}
