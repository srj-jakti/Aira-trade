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

/**
 * Hook for managing live candle data with scroll-back support
 * 
 * Features:
 * - Initial data fetch from live_candles
 * - Real-time updates via Supabase Realtime
 * - Scroll-back pagination for historical context
 * - Memory management with max candle limit
 */
export function useLiveCandles(options: UseLiveCandlesOptions): UseLiveCandlesReturn {
  const { 
    instrumentToken, 
    timeframe, 
    initialData = [], 
    enabled = true,
    maxCandles = 3000  // Memory limit
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

  // Initialize with provided data
  useEffect(() => {
    if (initialData.length > 0) {
      setCandles(initialData);
      // Set oldest timestamp for pagination
      const sorted = [...initialData].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      if (sorted.length > 0) {
        setOldestTimestamp(sorted[0].timestamp);
      }
    }
  }, [initialData]);

  // Handle new candle from realtime subscription
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

        let updated: CandleData[];
        
        if (existingIndex !== -1) {
          // Update existing candle
          updated = [...prev];
          updated[existingIndex] = candleData;
        } else {
          // Add new candle
          updated = [...prev, candleData].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        }

        // Memory management: trim oldest if exceeding limit
        if (updated.length > maxCandles) {
          updated = updated.slice(-maxCandles);
          // Update oldest timestamp after trim
          if (updated.length > 0) {
            setOldestTimestamp(updated[0].timestamp);
          }
        }

        return updated;
      });
    },
    [instrumentToken, timeframe, maxCandles]
  );

  // Setup realtime subscription
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

  /**
   * Fetch fresh data (replaces all candles)
   */
  const refetch = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/market-data/live?instrument=${instrumentToken}&timeframe=${timeframe}&limit=200`
      );
      if (response.ok) {
        const data = await response.json();
        const newCandles = data.candles || [];
        setCandles(newCandles);
        setDataSource(data.dataSource || "LIVE");
        setHasMore(data.hasMore ?? true);
        
        if (newCandles.length > 0) {
          setOldestTimestamp(data.oldestTimestamp || newCandles[0].timestamp);
        }
      }
    } catch (err) {
      console.error("Error refetching candles:", err);
    }
  }, [instrumentToken, timeframe]);

  /**
   * Fetch older candles (scroll-back / pagination)
   * Returns true if more data was loaded, false if no more data
   */
  const fetchOlder = useCallback(async (): Promise<boolean> => {
    if (!hasMore || isLoadingMore || !oldestTimestamp) {
      return false;
    }

    setIsLoadingMore(true);
    
    try {
      const response = await fetch(
        `/api/market-data/live?instrument=${instrumentToken}&timeframe=${timeframe}&limit=200&before=${oldestTimestamp}`
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

      setCandles((prev) => {
        // Prepend older candles
        const combined = [...olderCandles, ...prev];
        
        // Remove duplicates by timestamp
        const uniqueMap = new Map<string, CandleData>();
        for (const candle of combined) {
          uniqueMap.set(candle.timestamp, candle);
        }
        
        let unique = Array.from(uniqueMap.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Memory management: trim newest if exceeding limit
        if (unique.length > maxCandles) {
          unique = unique.slice(0, maxCandles);
        }

        return unique;
      });

      // Update pagination state
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
