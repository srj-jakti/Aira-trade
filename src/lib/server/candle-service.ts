/**
 * UNIFIED CANDLE SERVICE
 * 
 * This is the ONLY authorized way to access candle data in the application.
 * All components MUST use this service - no direct table queries allowed.
 * 
 * DATA TYPES:
 * - LIVE mode: Uses live_candles table (for charts, AI, scanner, auto-trading)
 * - RUNTIME_HISTORICAL mode: Fetches from Zerodha Historical API on-demand for deep scroll-back
 * - BACKTEST mode: Uses historical_candles table (for backtesting ONLY)
 * 
 * NEVER mix BACKTEST with LIVE/RUNTIME_HISTORICAL - strict separation enforced with errors.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export type CandleMode = "LIVE" | "RUNTIME_HISTORICAL" | "BACKTEST";

export interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface GetCandlesOptions {
  instrumentToken: number;
  timeframe: string;
  mode: CandleMode;
  limit?: number;
  beforeTimestamp?: string;  // For pagination (fetch older candles)
  fromDate?: Date;           // For BACKTEST mode date range
  toDate?: Date;             // For BACKTEST mode date range
}

export interface GetCandlesResult {
  candles: CandleData[];
  hasMore: boolean;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  mode: CandleMode;
  source: string;
}

/**
 * LIVE-HISTORICAL RETENTION POLICY
 * Defines how much recent data must always be available in live_candles
 */
export const LIVE_HISTORICAL_RETENTION: Record<string, { days: number; label: string }> = {
  "1s": { days: 1, label: "1 Day" },
  "5s": { days: 1, label: "1 Day" },
  "15s": { days: 2, label: "2 Days" },
  "1m": { days: 5, label: "5 Days" },
  "3m": { days: 3, label: "3 Days" },
  "5m": { days: 5, label: "5 Days" },
  "15m": { days: 10, label: "10 Days" },
  "1h": { days: 30, label: "30 Days" },
  "60m": { days: 30, label: "30 Days" },
};

/**
 * BACKTEST COVERAGE (separate from live)
 * Defines historical data depth for backtesting
 */
export const BACKTEST_COVERAGE: Record<string, { months: number; label: string }> = {
  "3minute": { months: 1, label: "1 Month" },
  "5minute": { months: 3, label: "3 Months" },
  "15minute": { months: 6, label: "6 Months" },
  "60minute": { months: 12, label: "1 Year" },
  "day": { months: 36, label: "3 Years" },
};

/**
 * UNIFIED CANDLE ACCESS FUNCTION
 * 
 * This is the ONLY function that should be used to fetch candles.
 * It enforces strict mode separation and provides pagination.
 */
export async function getCandles(options: GetCandlesOptions): Promise<GetCandlesResult> {
  const {
    instrumentToken,
    timeframe,
    mode,
    limit = 200,
    beforeTimestamp,
    fromDate,
    toDate,
  } = options;

  if (mode !== "LIVE" && mode !== "RUNTIME_HISTORICAL" && mode !== "BACKTEST") {
    throw new Error(`Invalid candle mode: ${mode}. Must be LIVE, RUNTIME_HISTORICAL, or BACKTEST.`);
  }

  if (mode === "LIVE") {
    return getLiveModeCandles(instrumentToken, timeframe, limit, beforeTimestamp);
  } else if (mode === "RUNTIME_HISTORICAL") {
    return getRuntimeHistoricalCandles(instrumentToken, timeframe, limit, beforeTimestamp);
  } else {
    return getBacktestModeCandles(instrumentToken, timeframe, fromDate, toDate);
  }
}

/**
 * LIVE MODE: Fetches from live_candles table
 * Used by: Charts, AI Analysis, Scanner, Auto-Trading
 */
async function getLiveModeCandles(
  instrumentToken: number,
  timeframe: string,
  limit: number,
  beforeTimestamp?: string
): Promise<GetCandlesResult> {
  // SAFETY GUARD: Prevent accidental historical_candles access
  // This query ONLY touches live_candles

  let query = supabaseAdmin
    .from("live_candles")
    .select("*")
    .eq("instrument_token", instrumentToken)
    .eq("timeframe", timeframe)
    .order("timestamp", { ascending: false })
    .limit(limit + 1); // Fetch one extra to check hasMore

  if (beforeTimestamp) {
    query = query.lt("timestamp", beforeTimestamp);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch live candles: ${error.message}`);
  }

  const hasMore = (data?.length || 0) > limit;
  const candles = (data || []).slice(0, limit);

  // Return oldest first (ascending order for charts)
  const sortedCandles = candles.reverse().map((c) => ({
    timestamp: new Date(c.timestamp),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseInt(c.volume) || 0,
    oi: parseInt(c.oi) || 0,
  }));

  return {
    candles: sortedCandles,
    hasMore,
    oldestTimestamp: sortedCandles.length > 0 ? sortedCandles[0].timestamp.toISOString() : null,
    newestTimestamp: sortedCandles.length > 0 ? sortedCandles[sortedCandles.length - 1].timestamp.toISOString() : null,
    mode: "LIVE",
    source: "live_candles",
  };
}

/**
 * RUNTIME_HISTORICAL MODE: Fetches from Zerodha Historical API on-demand
 * Used by: Charts (scroll-back), AI Analysis (deep context)
 * 
 * This does NOT use admin-saved historical_candles table.
 * Data is fetched dynamically and cached in live_candles for future requests.
 */
async function getRuntimeHistoricalCandles(
  instrumentToken: number,
  timeframe: string,
  limit: number,
  beforeTimestamp?: string
): Promise<GetCandlesResult> {
  const { marketDataEngine } = await import("@/lib/server/market-data-engine");
  const { decrypt } = await import("@/lib/server/encryption");

  const config = await marketDataEngine.getActiveConfig();
  if (!config || !config.access_token) {
    return {
      candles: [],
      hasMore: false,
      oldestTimestamp: null,
      newestTimestamp: null,
      mode: "RUNTIME_HISTORICAL",
      source: "zerodha_api_unavailable",
    };
  }

  const apiKey = decrypt(config.api_key);
  const accessToken = decrypt(config.access_token);

  const intervalMap: Record<string, string> = {
    "1s": "minute",
    "5s": "minute",
    "15s": "minute",
    "1m": "minute",
    "3m": "3minute",
    "5m": "5minute",
    "15m": "15minute",
    "30m": "30minute",
    "1h": "60minute",
    "day": "day",
  };

  const interval = intervalMap[timeframe] || "5minute";

  const daysBack: Record<string, number> = {
    "1m": 30,
    "3m": 60,
    "5m": 100,
    "15m": 200,
    "30m": 200,
    "1h": 400,
    "day": 2000,
  };

  const toDate = beforeTimestamp ? new Date(beforeTimestamp) : new Date();
  const lookbackDays = daysBack[timeframe] || 60;
  const fromDate = new Date(toDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const fromStr = fromDate.toISOString().split("T")[0];
  const toStr = toDate.toISOString().split("T")[0];

  try {
    console.log(`[CandleService] Fetching runtime historical: ${instrumentToken} ${interval} ${fromStr} to ${toStr}`);

    const response = await fetch(
      `https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}?from=${fromStr}&to=${toStr}`,
      {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error("[CandleService] Zerodha API error:", error);
      return {
        candles: [],
        hasMore: false,
        oldestTimestamp: null,
        newestTimestamp: null,
        mode: "RUNTIME_HISTORICAL",
        source: "zerodha_api_error",
      };
    }

    const data = await response.json();
    const rawCandles = data.data?.candles || [];

    console.log(`[CandleService] Got ${rawCandles.length} runtime historical candles from Zerodha`);

    if (rawCandles.length > 0) {
      const rows = rawCandles.map((c: (string | number)[]) => ({
        instrument_token: instrumentToken,
        timeframe: timeframe,
        timestamp: new Date(c[0] as string).toISOString(),
        open: c[1] as number,
        high: c[2] as number,
        low: c[3] as number,
        close: c[4] as number,
        volume: c[5] as number,
        oi: (c[6] as number) || 0,
      }));

      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await supabaseAdmin
          .from("live_candles")
          .upsert(batch, { onConflict: "instrument_token,timeframe,timestamp" });
      }
      console.log(`[CandleService] Cached ${rows.length} candles in live_candles`);
    }

    let filteredCandles = rawCandles;
    if (beforeTimestamp) {
      const beforeTime = new Date(beforeTimestamp).getTime();
      filteredCandles = rawCandles.filter((c: (string | number)[]) => 
        new Date(c[0] as string).getTime() < beforeTime
      );
    }

    const candles = filteredCandles.slice(-limit).map((c: (string | number)[]) => ({
      timestamp: new Date(c[0] as string),
      open: c[1] as number,
      high: c[2] as number,
      low: c[3] as number,
      close: c[4] as number,
      volume: c[5] as number,
      oi: (c[6] as number) || 0,
    }));

    return {
      candles,
      hasMore: filteredCandles.length > limit,
      oldestTimestamp: candles.length > 0 ? candles[0].timestamp.toISOString() : null,
      newestTimestamp: candles.length > 0 ? candles[candles.length - 1].timestamp.toISOString() : null,
      mode: "RUNTIME_HISTORICAL",
      source: "zerodha_historical_api",
    };
  } catch (error) {
    console.error("[CandleService] Error fetching runtime historical:", error);
    return {
      candles: [],
      hasMore: false,
      oldestTimestamp: null,
      newestTimestamp: null,
      mode: "RUNTIME_HISTORICAL",
      source: "fetch_error",
    };
  }
}

/**
 * BACKTEST MODE: Fetches from historical_candles table
 * Used by: Backtesting ONLY
 */
async function getBacktestModeCandles(
  instrumentToken: number,
  timeframe: string,
  fromDate?: Date,
  toDate?: Date
): Promise<GetCandlesResult> {
  // SAFETY GUARD: Prevent accidental live_candles access
  // This query ONLY touches historical_candles

  const coverage = BACKTEST_COVERAGE[timeframe];
  const defaultFromDate = new Date();
  defaultFromDate.setMonth(defaultFromDate.getMonth() - (coverage?.months || 12));

  const from = fromDate || defaultFromDate;
  const to = toDate || new Date();

  const { data, error } = await supabaseAdmin
    .from("historical_candles")
    .select("*")
    .eq("instrument_token", instrumentToken)
    .eq("timeframe", timeframe)
    .gte("timestamp", from.toISOString())
    .lte("timestamp", to.toISOString())
    .order("timestamp", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch historical candles: ${error.message}`);
  }

  const candles = (data || []).map((c) => ({
    timestamp: new Date(c.timestamp),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseInt(c.volume) || 0,
    oi: parseInt(c.oi) || 0,
  }));

  return {
    candles,
    hasMore: false,
    oldestTimestamp: candles.length > 0 ? candles[0].timestamp.toISOString() : null,
    newestTimestamp: candles.length > 0 ? candles[candles.length - 1].timestamp.toISOString() : null,
    mode: "BACKTEST",
    source: "historical_candles",
  };
}

/**
 * Get candles for AI Analysis with proper lookback
 * Ensures sufficient context for accurate analysis
 */
export async function getCandlesForAI(
  instrumentToken: number,
  timeframe: string,
  minCandles: number = 200
): Promise<{ candles: CandleData[]; sufficient: boolean; message?: string }> {
  const result = await getCandles({
    instrumentToken,
    timeframe,
    mode: "LIVE",
    limit: minCandles,
  });

  const sufficient = result.candles.length >= minCandles * 0.8; // 80% threshold

  return {
    candles: result.candles,
    sufficient,
    message: sufficient 
      ? undefined 
      : `Only ${result.candles.length} candles available (minimum ${minCandles} recommended for accurate analysis)`,
  };
}

/**
 * Get candles for Trading Engine evaluation
 * Returns recent candles for signal generation
 */
export async function getCandlesForTrading(
  instrumentToken: number,
  timeframe: string,
  lookbackCandles: number = 50
): Promise<{ candles: CandleData[]; sufficient: boolean }> {
  const result = await getCandles({
    instrumentToken,
    timeframe,
    mode: "LIVE",
    limit: lookbackCandles,
  });

  return {
    candles: result.candles,
    sufficient: result.candles.length >= lookbackCandles * 0.5, // 50% minimum for trading
  };
}

/**
 * Check live data coverage for an instrument
 * Used by market data worker to determine backfill needs
 */
export async function checkLiveCoverage(
  instrumentToken: number,
  timeframe: string
): Promise<{
  hasData: boolean;
  oldestTimestamp: Date | null;
  newestTimestamp: Date | null;
  candleCount: number;
  coverageDays: number;
  requiredDays: number;
  needsBackfill: boolean;
}> {
  const { data, error } = await supabaseAdmin
    .from("live_candles")
    .select("timestamp")
    .eq("instrument_token", instrumentToken)
    .eq("timeframe", timeframe)
    .order("timestamp", { ascending: true });

  if (error || !data || data.length === 0) {
    const retention = LIVE_HISTORICAL_RETENTION[timeframe] || { days: 5 };
    return {
      hasData: false,
      oldestTimestamp: null,
      newestTimestamp: null,
      candleCount: 0,
      coverageDays: 0,
      requiredDays: retention.days,
      needsBackfill: true,
    };
  }

  const oldest = new Date(data[0].timestamp);
  const newest = new Date(data[data.length - 1].timestamp);
  const coverageDays = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24);
  const retention = LIVE_HISTORICAL_RETENTION[timeframe] || { days: 5 };

  return {
    hasData: true,
    oldestTimestamp: oldest,
    newestTimestamp: newest,
    candleCount: data.length,
    coverageDays,
    requiredDays: retention.days,
    needsBackfill: coverageDays < retention.days,
  };
}

/**
 * SAFETY: Validate that we never mix modes incorrectly
 * LIVE and RUNTIME_HISTORICAL can be used together for charts/AI
 * BACKTEST must only be used for backtesting
 */
export function validateCandleMode(
  requestedMode: CandleMode,
  component: string
): void {
  const liveComponents = ["chart", "ai_analysis", "scanner", "auto_trading", "trading_engine"];
  const backtestComponents = ["backtest", "strategy_backtest"];

  const componentLower = component.toLowerCase();
  
  if (requestedMode === "BACKTEST" && liveComponents.some(c => componentLower.includes(c))) {
    throw new Error(
      `SAFETY VIOLATION: Component "${component}" requested BACKTEST mode but should use LIVE or RUNTIME_HISTORICAL mode. ` +
      `Backtest data is for backtesting only.`
    );
  }

  if (requestedMode === "LIVE" && backtestComponents.some(c => componentLower.includes(c))) {
    throw new Error(
      `SAFETY VIOLATION: Component "${component}" requested LIVE mode but should use BACKTEST mode. ` +
      `Backtesting must use historical_candles for reproducibility.`
    );
  }
}
