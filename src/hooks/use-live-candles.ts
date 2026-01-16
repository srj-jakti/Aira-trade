"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { CandleData } from "@/lib/types/market-data";

interface UseLiveCandlesOptions {
  instrumentToken: number;
  timeframe: string;
  initialData?: CandleData[];
  enabled?: boolean;
  maxCandles?: number;
  pollInterval?: number;
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
    maxCandles = 5000,
    pollInterval = 5000,
  } = options;
  
  const [candles, setCandles] = useState<CandleData[]>(initialData);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dataSource, setDataSource] = useState<string>("ZERODHA_REALTIME");
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchAttemptsRef = useRef(0);
  const prevInstrumentRef = useRef<number>(instrumentToken);
  const prevTimeframeRef = useRef<string>(timeframe);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const instrumentChanged = prevInstrumentRef.current !== instrumentToken;
    const timeframeChanged = prevTimeframeRef.current !== timeframe;
    
    if (instrumentChanged || timeframeChanged) {
      setCandles([]);
      setOldestTimestamp(null);
      setHasMore(true);
      setDataSource("ZERODHA_REALTIME");
      setError(null);
      fetchAttemptsRef.current = 0;
      
      prevInstrumentRef.current = instrumentToken;
      prevTimeframeRef.current = timeframe;
    }
  }, [instrumentToken, timeframe]);

  const fetchCandles = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current && !isInitial) return;
    isFetchingRef.current = true;

    try {
      const response = await fetch(
        `/api/market-data/live?instrument=${instrumentToken}&timeframe=${timeframe}&limit=500`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch candles");
      }

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setIsConnected(false);
        return;
      }

      const newCandles: CandleData[] = data.candles || [];
      setDataSource(data.dataSource || "ZERODHA_REALTIME");
      setHasMore(data.hasMore ?? true);
      setError(null);
      setIsConnected(true);
      fetchAttemptsRef.current = 0;
      
      if (newCandles.length > 0) {
        setOldestTimestamp(data.oldestTimestamp || newCandles[0].timestamp);
        
        setCandles(prev => {
          if (isInitial || prev.length === 0) {
            return newCandles;
          }

          const existingMap = new Map(prev.map(c => [c.timestamp, c]));
          
          for (const candle of newCandles) {
            existingMap.set(candle.timestamp, candle);
          }
          
          let merged = Array.from(existingMap.values()).sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          if (merged.length > maxCandles) {
            merged = merged.slice(-maxCandles);
          }

          return merged;
        });
      }
    } catch (err) {
      console.error("Error fetching candles:", err);
      if (isInitial) {
        setError("Failed to load chart data");
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [instrumentToken, timeframe, maxCandles]);

  useEffect(() => {
    if (!enabled || !instrumentToken) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    fetchCandles(true);

    pollIntervalRef.current = setInterval(() => {
      fetchCandles(false);
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enabled, instrumentToken, timeframe, fetchCandles, pollInterval]);

  const refetch = useCallback(async () => {
    await fetchCandles(true);
  }, [fetchCandles]);

  const fetchOlder = useCallback(async (): Promise<boolean> => {
    if (!hasMore || isLoadingMore) {
      return false;
    }

    if (fetchAttemptsRef.current >= 5) {
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

      setDataSource(data.dataSource || "ZERODHA_REALTIME");
      
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
