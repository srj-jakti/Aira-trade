"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import type { LiveCandle, CandleData } from "@/lib/types/market-data";

interface UseLiveCandlesOptions {
  instrumentToken: number;
  timeframe: string;
  initialData?: CandleData[];
  enabled?: boolean;
}

export function useLiveCandles(options: UseLiveCandlesOptions) {
  const { instrumentToken, timeframe, initialData = [], enabled = true } = options;
  const [candles, setCandles] = useState<CandleData[]>(initialData);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    if (initialData.length > 0) {
      setCandles(initialData);
    }
  }, [initialData]);

  const handleNewCandle = useCallback(
    (payload: RealtimePostgresInsertPayload<LiveCandle>) => {
      const newCandle = payload.new;

      if (
        newCandle.instrument_token !== instrumentToken ||
        newCandle.timeframe !== timeframe
      ) {
        return;
      }

      const candleData: CandleData = {
        timestamp: newCandle.timestamp,
        open: Number(newCandle.open),
        high: Number(newCandle.high),
        low: Number(newCandle.low),
        close: Number(newCandle.close),
        volume: Number(newCandle.volume) || 0,
      };

      setCandles((prev) => {
        const existingIndex = prev.findIndex(
          (c) => c.timestamp === candleData.timestamp
        );

        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = candleData;
          return updated;
        }

        const sorted = [...prev, candleData].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (sorted.length > 300) {
          return sorted.slice(-300);
        }

        return sorted;
      });
    },
    [instrumentToken, timeframe]
  );

  useEffect(() => {
    const supabase = supabaseRef.current;

    if (!enabled || !instrumentToken) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const channelName = `live_candles_${instrumentToken}_${timeframe}`;

    const channel = supabase
      .channel(channelName)
      .on<LiveCandle>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_candles",
          filter: `instrument_token=eq.${instrumentToken}`,
        },
        handleNewCandle
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
  }, [enabled, instrumentToken, timeframe, handleNewCandle]);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/market-data/live?instrument=${instrumentToken}&timeframe=${timeframe}&limit=200`
      );
      if (response.ok) {
        const data = await response.json();
        setCandles(data.candles || []);
      }
    } catch (err) {
      console.error("Error refetching candles:", err);
    }
  }, [instrumentToken, timeframe]);

  return {
    candles,
    isConnected,
    error,
    refetch,
  };
}
