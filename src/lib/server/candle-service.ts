/**
 * UNIFIED CANDLE SERVICE
 * 
 * This is the ONLY authorized way to access candle data in the application.
 * All components MUST use this service - no direct table queries allowed.
 * 
 * DATA TYPES:
 * - LIVE mode: Uses live_candles table (for charts, AI, scanner, auto-trading)
 * - BACKTEST mode: Uses historical_candles table (for backtesting ONLY)
 * 
 * NEVER mix these modes - strict separation enforced with errors.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export type CandleMode = "LIVE" | "BACKTEST";

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

  // SAFETY GUARD: Validate mode
  if (mode !== "LIVE" && mode !== "BACKTEST") {
    throw new Error(`Invalid candle mode: ${mode}. Must be LIVE or BACKTEST.`);
  }

  if (mode === "LIVE") {
    return getLiveModeCandles(instrumentToken, timeframe, limit, beforeTimestamp);
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
 * SAFETY: Validate that we never mix modes
 * Call this in any component using candles
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
      `SAFETY VIOLATION: Component "${component}" requested BACKTEST mode but should use LIVE mode. ` +
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
