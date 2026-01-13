/**
 * LIVE-HISTORICAL BACKFILL SERVICE
 * 
 * Responsible for ensuring live_candles table has sufficient recent history.
 * This service fetches data from Zerodha Historical API and stores in live_candles.
 * 
 * IMPORTANT:
 * - ONLY writes to live_candles (never historical_candles)
 * - Uses Zerodha Historical API for recent data
 * - Respects retention policy per timeframe
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * LIVE-HISTORICAL RETENTION POLICY
 * Must match the policy in candle-service.ts
 */
const LIVE_HISTORICAL_RETENTION: Record<string, { days: number; zerodhaInterval: string }> = {
  "1m": { days: 5, zerodhaInterval: "minute" },
  "3m": { days: 3, zerodhaInterval: "3minute" },
  "5m": { days: 5, zerodhaInterval: "5minute" },
  "15m": { days: 10, zerodhaInterval: "15minute" },
  "1h": { days: 30, zerodhaInterval: "60minute" },
  "60m": { days: 30, zerodhaInterval: "60minute" },
};

// Timeframes to backfill for each instrument
const BACKFILL_TIMEFRAMES = ["5m", "15m", "1h"];

interface BackfillResult {
  instrumentToken: number;
  timeframe: string;
  candlesInserted: number;
  fromDate: string;
  toDate: string;
  success: boolean;
  error?: string;
}

export class BackfillService {
  private supabase: SupabaseClient;
  private apiKey: string;
  private accessToken: string;
  private isRunning: boolean = false;
  private backfillQueue: Array<{ instrumentToken: number; timeframe: string }> = [];

  constructor(supabase: SupabaseClient, apiKey: string, accessToken: string) {
    this.supabase = supabase;
    this.apiKey = apiKey;
    this.accessToken = accessToken;
  }

  /**
   * Check coverage and backfill if needed for an instrument
   */
  async checkAndBackfillInstrument(instrumentToken: number): Promise<BackfillResult[]> {
    const results: BackfillResult[] = [];

    for (const timeframe of BACKFILL_TIMEFRAMES) {
      const coverage = await this.checkCoverage(instrumentToken, timeframe);
      
      if (coverage.needsBackfill) {
        console.log(
          `[BackfillService] ${instrumentToken} ${timeframe}: needs backfill ` +
          `(${coverage.coverageDays.toFixed(1)} days < ${coverage.requiredDays} days required)`
        );
        
        const result = await this.backfillTimeframe(instrumentToken, timeframe, coverage);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Check current coverage for an instrument/timeframe
   */
  private async checkCoverage(
    instrumentToken: number,
    timeframe: string
  ): Promise<{
    hasData: boolean;
    oldestTimestamp: Date | null;
    newestTimestamp: Date | null;
    coverageDays: number;
    requiredDays: number;
    needsBackfill: boolean;
  }> {
    const { data, error } = await this.supabase
      .from("live_candles")
      .select("timestamp")
      .eq("instrument_token", instrumentToken)
      .eq("timeframe", timeframe)
      .order("timestamp", { ascending: true })
      .limit(1);

    const { data: newestData } = await this.supabase
      .from("live_candles")
      .select("timestamp")
      .eq("instrument_token", instrumentToken)
      .eq("timeframe", timeframe)
      .order("timestamp", { ascending: false })
      .limit(1);

    const retention = LIVE_HISTORICAL_RETENTION[timeframe] || { days: 5, zerodhaInterval: "5minute" };

    if (error || !data || data.length === 0) {
      return {
        hasData: false,
        oldestTimestamp: null,
        newestTimestamp: null,
        coverageDays: 0,
        requiredDays: retention.days,
        needsBackfill: true,
      };
    }

    const oldest = new Date(data[0].timestamp);
    const newest = newestData?.[0] ? new Date(newestData[0].timestamp) : new Date(0);
    const coverageDays = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24);

    // Check for gaps: 
    // 1. If we don't have enough total days
    // 2. If the newest data is too old (e.g., more than 1 hour old during market hours)
    // 3. If the oldest data isn't old enough (we need more history)
    
    const now = new Date();
    const isMarketHours = now.getUTCHours() >= 3 && now.getUTCHours() <= 10; // Simple IST check: 9:15 AM - 3:30 PM is roughly 3:45 - 10:00 UTC
    const newestIsOld = (now.getTime() - newest.getTime()) > (1000 * 60 * 60); // More than 1 hour old
    
    const needsBackfill = 
      coverageDays < retention.days * 0.8 || 
      (isMarketHours && newestIsOld) ||
      oldest > new Date(now.getTime() - (retention.days * 24 * 60 * 60 * 1000));

    return {
      hasData: true,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      coverageDays,
      requiredDays: retention.days,
      needsBackfill,
    };
  }

  /**
   * Backfill data for a specific instrument/timeframe
   */
  private async backfillTimeframe(
    instrumentToken: number,
    timeframe: string,
    coverage: {
      hasData: boolean;
      oldestTimestamp: Date | null;
      newestTimestamp: Date | null;
      requiredDays: number;
    }
  ): Promise<BackfillResult> {
    const retention = LIVE_HISTORICAL_RETENTION[timeframe];
    if (!retention) {
      return {
        instrumentToken,
        timeframe,
        candlesInserted: 0,
        fromDate: "",
        toDate: "",
        success: false,
        error: `Unknown timeframe: ${timeframe}`,
      };
    }

    try {
      // Calculate date range to fetch
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - retention.days);

      // If we have some data, only fetch what's missing
      if (coverage.hasData && coverage.oldestTimestamp) {
        // Fetch from (retention days ago) to (oldest existing data)
        // This fills the gap in historical data
        const targetFromDate = new Date();
        targetFromDate.setDate(targetFromDate.getDate() - retention.days);
        
        // Only if oldest is newer than target
        if (coverage.oldestTimestamp > targetFromDate) {
          fromDate.setTime(targetFromDate.getTime());
          toDate.setTime(coverage.oldestTimestamp.getTime());
        } else {
          // Already have enough coverage
          return {
            instrumentToken,
            timeframe,
            candlesInserted: 0,
            fromDate: fromDate.toISOString(),
            toDate: toDate.toISOString(),
            success: true,
          };
        }
      }

      console.log(
        `[BackfillService] Fetching ${instrumentToken} ${timeframe} from ${fromDate.toISOString()} to ${toDate.toISOString()}`
      );

      // Fetch from Zerodha Historical API
      const candles = await this.fetchFromZerodha(
        instrumentToken,
        retention.zerodhaInterval,
        fromDate,
        toDate
      );

      if (candles.length === 0) {
        return {
          instrumentToken,
          timeframe,
          candlesInserted: 0,
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
          success: true,
        };
      }

      // Insert into live_candles (NOT historical_candles!)
      const rows = candles.map((c) => ({
        instrument_token: instrumentToken,
        timeframe: timeframe,
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        oi: c.oi || 0,
      }));

      // Batch insert
      const batchSize = 500;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await this.supabase
          .from("live_candles")  // ONLY live_candles, never historical_candles
          .upsert(batch, { onConflict: "instrument_token,timeframe,timestamp" });

        if (!error) {
          inserted += batch.length;
        } else {
          console.error(`[BackfillService] Insert error:`, error.message);
        }
      }

      console.log(
        `[BackfillService] Inserted ${inserted} candles for ${instrumentToken} ${timeframe}`
      );

      return {
        instrumentToken,
        timeframe,
        candlesInserted: inserted,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        success: true,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[BackfillService] Backfill failed for ${instrumentToken} ${timeframe}:`, errMsg);
      
      return {
        instrumentToken,
        timeframe,
        candlesInserted: 0,
        fromDate: "",
        toDate: "",
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Fetch historical candles from Zerodha API
   */
  private async fetchFromZerodha(
    instrumentToken: number,
    interval: string,
    from: Date,
    to: Date
  ): Promise<Array<{
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi?: number;
  }>> {
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    const url = `https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}?from=${fromStr}&to=${toStr}`;

    try {
      const response = await fetch(url, {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${this.apiKey}:${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const candles = data.data?.candles || [];

      return candles.map((c: (string | number)[]) => ({
        timestamp: new Date(c[0] as string).toISOString(),
        open: c[1] as number,
        high: c[2] as number,
        low: c[3] as number,
        close: c[4] as number,
        volume: c[5] as number,
        oi: (c[6] as number) || 0,
      }));
    } catch (error) {
      console.error(`[BackfillService] Zerodha API error:`, error);
      throw error;
    }
  }

  /**
   * Queue an instrument for backfill
   */
  queueBackfill(instrumentToken: number, timeframe: string): void {
    const exists = this.backfillQueue.some(
      (item) => item.instrumentToken === instrumentToken && item.timeframe === timeframe
    );
    
    if (!exists) {
      this.backfillQueue.push({ instrumentToken, timeframe });
    }
  }

  /**
   * Process the backfill queue (called periodically)
   */
  async processQueue(): Promise<void> {
    if (this.isRunning || this.backfillQueue.length === 0) return;

    this.isRunning = true;
    
    try {
      // Process up to 5 items at a time
      const batch = this.backfillQueue.splice(0, 5);
      
      for (const item of batch) {
        const coverage = await this.checkCoverage(item.instrumentToken, item.timeframe);
        if (coverage.needsBackfill) {
          await this.backfillTimeframe(item.instrumentToken, item.timeframe, coverage);
        }
        // Small delay between requests to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Backfill all CORE instruments on startup
   */
  async backfillCoreInstruments(): Promise<void> {
    console.log("[BackfillService] Starting CORE instrument backfill...");

    // Get CORE subscribed instruments
    const { data: instruments } = await this.supabase
      .from("instruments")
      .select("instrument_token, tradingsymbol")
      .eq("is_subscribed", true)
      .in("subscription_priority", ["core", "high"])
      .limit(50);

    if (!instruments || instruments.length === 0) {
      console.log("[BackfillService] No CORE instruments to backfill");
      return;
    }

    console.log(`[BackfillService] Checking ${instruments.length} CORE instruments for backfill`);

    let backfillCount = 0;
    
    for (const inst of instruments) {
      const results = await this.checkAndBackfillInstrument(inst.instrument_token);
      const filled = results.filter((r) => r.candlesInserted > 0);
      
      if (filled.length > 0) {
        backfillCount += filled.length;
        console.log(
          `[BackfillService] ${inst.tradingsymbol}: backfilled ${filled.map((f) => `${f.timeframe}(${f.candlesInserted})`).join(", ")}`
        );
      }

      // Delay to avoid API rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`[BackfillService] CORE backfill complete: ${backfillCount} timeframes updated`);
  }

  /**
   * Clean up old data beyond retention policy
   */
  async cleanupOldData(): Promise<void> {
    console.log("[BackfillService] Cleaning up old market data (ticks & candles)...");

    try {
      // Call the SQL function for unified pruning
      const { error: pruneError } = await this.supabase.rpc("prune_old_market_data");
      if (pruneError) {
        console.error("[BackfillService] SQL Pruning error:", pruneError.message);
      } else {
        console.log("[BackfillService] SQL Pruning successful");
      }
    } catch (err) {
      console.error("[BackfillService] Pruning RPC failed:", err);
    }

    for (const [timeframe, retention] of Object.entries(LIVE_HISTORICAL_RETENTION)) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retention.days - 1); // Keep 1 extra day buffer

      const { error, count } = await this.supabase
        .from("live_candles")
        .delete()
        .eq("timeframe", timeframe)
        .lt("timestamp", cutoffDate.toISOString())
        .select("*", { count: "exact", head: true });

      if (!error && count && count > 0) {
        console.log(`[BackfillService] Cleaned ${count} old ${timeframe} candles`);
      }
    }
  }
}
