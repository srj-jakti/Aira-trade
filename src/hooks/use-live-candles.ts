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
  maxCandles?: number;
}

interface UseLiveCandlesReturn {
  candles: CandleData[];
  isConnected: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  fetchOlder: () => Promise<boolean>;
  hasMore: boolean;
  isLoadingMore: boolean;
  dataSource: string;
}

export function useLiveCandles(options: UseLiveCandlesOptions): UseLiveCandlesReturn {
  const { 
    instrumentToken, 
    timeframe, 
    initialData = [], 
    enabled = true,
    maxCandles = 5000
  } = options;
  
  const [candles, setCandles] = useState<CandleData[]>(initialData);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dataSource, setDataSource] = useState<string>("LIVE");
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());
  const fetchAttemptsRef = useRef(0);
  const prevInstrumentRef = useRef<number>(instrumentToken);
  const prevTimeframeRef = useRef<string>(timeframe);

  useEffect(() => {
    const instrumentChanged = prevInstrumentRef.current !== instrumentToken;
    const timeframeChanged = prevTimeframeRef.current !== timeframe;
    
    if (instrumentChanged || timeframeChanged) {
      setCandles([]);
      setOldestTimestamp(null);
      setHasMore(true);
      setDataSource("LIVE");
      fetchAttemptsRef.current = 0;
      
      prevInstrumentRef.current = instrumentToken;
      prevTimeframeRef.current = timeframe;
    }
  }, [instrumentToken, timeframe]);

  useEffect(() => {
    if (initialData.length > 0) {
      setCandles(initialData);
      const sorted = [...initialData].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      if (sorted.length > 0) {
        setOldestTimestamp(sorted[0].timestamp);
      }
      setHasMore(true);
      fetchAttemptsRef.current = 0;
    }
  }, [initialData]);

  const handleNewCandle = useCallback(
    (payload: RealtimePostgresInsertPayload<LiveCandle>) => {
      const newCandle = payload.new;

      const normalizedTimeframe = normalizeTimeframe(timeframe);
      const candleTimeframe = normalizeTimeframe(newCandle.timeframe);

      if (
        String(newCandle.instrument_token) !== String(instrumentToken) ||
        candleTimeframe !== normalizedTimeframe
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
      indicators: newCandle.indicators,
    };


      setCandles((prev) => {
        const existingIndex = prev.findIndex(
          (c) => c.timestamp === candleData.timestamp
        );

        let updated: CandleData[];
        
        if (existingIndex !== -1) {
          updated = [...prev];
          updated[existingIndex] = candleData;
        } else {
          updated = [...prev, candleData].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        }

        if (updated.length > maxCandles) {
          updated = updated.slice(-maxCandles);
          if (updated.length > 0) {
            setOldestTimestamp(updated[0].timestamp);
          }
        }

        return updated;
      });
    },
    [instrumentToken, timeframe, maxCandles]
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

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `live_candles_${instrumentToken}_${timeframe}_${Date.now()}`;

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
        `/api/market-data/live?instrument=${instrumentToken}&timeframe=${timeframe}&limit=500`
      );
      if (response.ok) {
        const data = await response.json();
        const newCandles = data.candles || [];
        setCandles(newCandles);
        setDataSource(data.dataSource || "LIVE");
        setHasMore(data.hasMore ?? true);
        fetchAttemptsRef.current = 0;
        
        if (newCandles.length > 0) {
          setOldestTimestamp(data.oldestTimestamp || newCandles[0].timestamp);
        }
      }
    } catch (err) {
      console.error("Error refetching candles:", err);
    }
  }, [instrumentToken, timeframe]);

  const fetchOlder = useCallback(async (): Promise<boolean> => {
    if (!hasMore || isLoadingMore) {
      return false;
    }

    if (fetchAttemptsRef.current >= 5) {
      console.log("[useLiveCandles] Max fetch attempts reached, stopping");
      setHasMore(false);
      return false;
    }

    setIsLoadingMore(true);
    fetchAttemptsRef.current++;
    
    try {
      const beforeParam = oldestTimestamp 
        ? `&before=${encodeURIComponent(oldestTimestamp)}`
        : "";
      
      const response = await fetch(
        `/api/market-data/live?instrument=${instrumentToken}&timeframe=${timeframe}&limit=500${beforeParam}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch older candles");
      }

      const data = await response.json();
      const olderCandles: CandleData[] = data.candles || [];
      
      if (olderCandles.length === 0) {
        setHasMore(false);
        return false;
      }

      setDataSource(data.dataSource || "LIVE");
      
      setCandles((prev) => {
        const combined = [...olderCandles, ...prev];
        
        const uniqueMap = new Map<string, CandleData>();
        for (const candle of combined) {
          uniqueMap.set(candle.timestamp, candle);
        }
        
        let unique = Array.from(uniqueMap.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (unique.length > maxCandles) {
          unique = unique.slice(0, maxCandles);
        }

        return unique;
      });

      setHasMore(data.hasMore ?? false);
      if (data.oldestTimestamp) {
        setOldestTimestamp(data.oldestTimestamp);
      } else if (olderCandles.length > 0) {
        setOldestTimestamp(olderCandles[0].timestamp);
      }

      return olderCandles.length > 0;
    } catch (err) {
      console.error("Error fetching older candles:", err);
      setError("Failed to load more data");
      return false;
    } finally {
      setIsLoadingMore(false);
    }
  }, [instrumentToken, timeframe, hasMore, isLoadingMore, oldestTimestamp, maxCandles]);

  return {
    candles,
    isConnected,
    error,
    refetch,
    fetchOlder,
    hasMore,
    isLoadingMore,
    dataSource,
  };
}

function normalizeTimeframe(tf: string): string {
  const aliases: Record<string, string> = {
    "1d": "day",
    "day": "day",
    "D": "day",
    "1w": "week",
    "week": "week",
    "W": "week",
    "1M": "month",
    "month": "month",
  };
  return aliases[tf] || tf;
}
