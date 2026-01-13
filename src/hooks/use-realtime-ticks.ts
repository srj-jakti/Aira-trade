"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";

export interface RealtimeTick {
  id: string;
  instrument_token: number;
  last_price: number;
  last_quantity: number | null;
  average_price: number | null;
  volume: number | null;
  buy_quantity: number | null;
  sell_quantity: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  change: number | null;
  change_percent: number | null;
  last_trade_time: string | null;
  oi: number | null;
  oi_day_high: number | null;
  oi_day_low: number | null;
  tick_timestamp: string;
  created_at: string;
}

interface UseRealtimeTicksOptions {
  instrumentTokens?: number[];
  onTick?: (tick: RealtimeTick) => void;
  enabled?: boolean;
}

export function useRealtimeTicks(options: UseRealtimeTicksOptions = {}) {
  const { instrumentTokens, onTick, enabled = true } = options;
  const [ticks, setTicks] = useState<Map<number, RealtimeTick>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());

  const handleTick = useCallback(
    (payload: RealtimePostgresInsertPayload<RealtimeTick>) => {
      const tick = payload.new;

      if (instrumentTokens && !instrumentTokens.map(String).includes(String(tick.instrument_token))) {
        return;
      }

      setTicks((prev) => {
        const next = new Map(prev);
        next.set(Number(tick.instrument_token), tick);
        return next;
      });

      onTick?.(tick);
    },
    [instrumentTokens, onTick]
  );

  useEffect(() => {
    const supabase = supabaseRef.current;
    
    if (!enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel("realtime_ticks_channel")
      .on<RealtimeTick>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "realtime_ticks",
        },
        handleTick
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
        } else if (status === "CHANNEL_ERROR") {
          setIsConnected(false);
          setError("Failed to connect to realtime");
        } else if (status === "TIMED_OUT") {
          setIsConnected(false);
          setError("Connection timed out");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, handleTick]);

  const getTickForToken = useCallback(
    (token: number): RealtimeTick | undefined => {
      return ticks.get(token);
    },
    [ticks]
  );

  const getAllTicks = useCallback((): RealtimeTick[] => {
    return Array.from(ticks.values());
  }, [ticks]);

  return {
    ticks,
    isConnected,
    error,
    getTickForToken,
    getAllTicks,
  };
}

interface UseLatestPriceOptions {
  instrumentToken: number;
  enabled?: boolean;
}

export function useLatestPrice(options: UseLatestPriceOptions) {
  const { instrumentToken, enabled = true } = options;
  const [price, setPrice] = useState<number | null>(null);
  const [tick, setTick] = useState<RealtimeTick | null>(null);

  const { getTickForToken, isConnected, error } = useRealtimeTicks({
    instrumentTokens: [instrumentToken],
    enabled,
    onTick: (newTick) => {
      if (newTick.instrument_token === instrumentToken) {
        setPrice(newTick.last_price);
        setTick(newTick);
      }
    },
  });

  useEffect(() => {
    const latestTick = getTickForToken(instrumentToken);
    if (latestTick) {
      setPrice(latestTick.last_price);
      setTick(latestTick);
    }
  }, [instrumentToken, getTickForToken]);

  return {
    price,
    tick,
    isConnected,
    error,
  };
}

export function useMultipleLatestPrices(instrumentTokens: number[], enabled = true) {
  const [prices, setPrices] = useState<Map<number, number>>(new Map());

  const { ticks, isConnected, error } = useRealtimeTicks({
    instrumentTokens,
    enabled,
  });

  useEffect(() => {
    const newPrices = new Map<number, number>();
    ticks.forEach((tick, token) => {
      if (instrumentTokens.includes(token)) {
        newPrices.set(token, tick.last_price);
      }
    });
    setPrices(newPrices);
  }, [ticks, instrumentTokens]);

  const getPrice = useCallback(
    (token: number): number | undefined => {
      return prices.get(token);
    },
    [prices]
  );

  return {
    prices,
    getPrice,
    isConnected,
    error,
  };
}
