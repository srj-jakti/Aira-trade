"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  throttleMs?: number;
}

const globalTickCache = new Map<number, MarketTick>();
const subscribers = new Set<(tick: MarketTick) => void>();
let globalChannel: RealtimeChannel | null = null;
let isGlobalConnected = false;

export function useMarketData(options: UseMarketDataOptions = {}) {
  const {
    instrumentTokens = [],
    autoSubscribe = true,
    enabled = true,
    onTick,
    throttleMs = 100,
  } = options;

  const [state, setState] = useState<MarketDataState>({
    ticks: new Map(),
    isConnected: false,
    connectionStatus: "disconnected",
    error: null,
    lastUpdate: null,
    subscribedCount: 0,
  });

  const supabaseRef = useRef(createClient());
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdatesRef = useRef<Map<number, MarketTick>>(new Map());
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const tokenSet = useMemo(() => new Set(instrumentTokens), [instrumentTokens]);

  const flushUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.size === 0) return;

    setState((prev) => {
      const newTicks = new Map(prev.ticks);
      pendingUpdatesRef.current.forEach((tick, token) => {
        if (tokenSet.size === 0 || tokenSet.has(token)) {
          newTicks.set(token, tick);
        }
      });
      pendingUpdatesRef.current.clear();
      return {
        ...prev,
        ticks: newTicks,
        lastUpdate: new Date(),
        subscribedCount: newTicks.size,
      };
    });
  }, [tokenSet]);

  const handleTick = useCallback(
    (tick: MarketTick) => {
      globalTickCache.set(tick.instrument_token, tick);

      if (tokenSet.size === 0 || tokenSet.has(tick.instrument_token)) {
        pendingUpdatesRef.current.set(tick.instrument_token, tick);

        const now = Date.now();
        if (now - lastUpdateRef.current >= throttleMs) {
          lastUpdateRef.current = now;
          flushUpdates();
        } else if (!flushTimeoutRef.current) {
          flushTimeoutRef.current = setTimeout(() => {
            flushTimeoutRef.current = null;
            lastUpdateRef.current = Date.now();
            flushUpdates();
          }, throttleMs - (now - lastUpdateRef.current));
        }

        onTick?.(tick);
      }
    },
    [tokenSet, throttleMs, flushUpdates, onTick]
  );

  useEffect(() => {
    if (!enabled) return;

    subscribers.add(handleTick);

    if (!globalChannel) {
      const supabase = supabaseRef.current;
      setState((prev) => ({ ...prev, connectionStatus: "connecting" }));

      globalChannel = supabase
        .channel("global_market_data")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "realtime_ticks",
          },
          (payload) => {
            const tick = payload.new as MarketTick;
            subscribers.forEach((cb) => cb(tick));
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            isGlobalConnected = true;
            subscribers.forEach(() => {
              setState((prev) => ({
                ...prev,
                isConnected: true,
                connectionStatus: "connected",
                error: null,
              }));
            });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            isGlobalConnected = false;
            subscribers.forEach(() => {
              setState((prev) => ({
                ...prev,
                isConnected: false,
                connectionStatus: "error",
                error: status === "TIMED_OUT" ? "Connection timed out" : "Connection error",
              }));
            });
          }
        });
    } else {
      setState((prev) => ({
        ...prev,
        isConnected: isGlobalConnected,
        connectionStatus: isGlobalConnected ? "connected" : "disconnected",
      }));
    }

    if (tokenSet.size > 0) {
      const initialTicks = new Map<number, MarketTick>();
      tokenSet.forEach((token) => {
        const cached = globalTickCache.get(token);
        if (cached) {
          initialTicks.set(token, cached);
        }
      });
      if (initialTicks.size > 0) {
        setState((prev) => ({
          ...prev,
          ticks: initialTicks,
          subscribedCount: initialTicks.size,
        }));
      }
    }

    return () => {
      subscribers.delete(handleTick);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, [enabled, handleTick, tokenSet]);

  useEffect(() => {
    if (!enabled || !autoSubscribe || instrumentTokens.length === 0) return;

    const requestSubscription = async () => {
      try {
        await fetch("/api/market-data/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrumentTokens }),
        });
      } catch (err) {
        console.error("[useMarketData] Subscription request failed:", err);
      }
    };

    requestSubscription();
  }, [enabled, autoSubscribe, instrumentTokens]);

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
