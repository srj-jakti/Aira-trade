/**
 * TICK AGGREGATION LAYER
 * Aggregates raw ticks from realtime_ticks into 1s, 5s, 15s OHLC candles
 * Idempotent and restart-safe
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface RawTick {
  id: string;
  instrument_token: number;
  last_price: number;
  volume: number | null;
  oi: number | null;
  tick_timestamp: string;
}

export interface AggregatedCandle {
  instrument_token: number;
  interval_seconds: number;
  bucket_start: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
  tick_count: number;
}

interface CandleBuffer {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
  tickCount: number;
  firstTickTime: number;
}

type IntervalSeconds = 1 | 5 | 15;

class TickAggregator {
  private static instance: TickAggregator;
  private buffers: Map<string, CandleBuffer> = new Map();
  private isRunning = false;
  private processInterval: NodeJS.Timeout | null = null;
  private lastProcessedId: string | null = null;
  private readonly INTERVALS: IntervalSeconds[] = [1, 5, 15];

  private constructor() {}

  static getInstance(): TickAggregator {
    if (!TickAggregator.instance) {
      TickAggregator.instance = new TickAggregator();
    }
    return TickAggregator.instance;
  }

  private getBufferKey(instrumentToken: number, interval: IntervalSeconds, bucketStart: number): string {
    return `${instrumentToken}:${interval}:${bucketStart}`;
  }

  private getBucketStart(timestamp: Date, intervalSeconds: IntervalSeconds): number {
    const ms = timestamp.getTime();
    return Math.floor(ms / (intervalSeconds * 1000)) * (intervalSeconds * 1000);
  }

  processTick(tick: RawTick): void {
    const tickTime = new Date(tick.tick_timestamp);
    
    for (const interval of this.INTERVALS) {
      const bucketStart = this.getBucketStart(tickTime, interval);
      const key = this.getBufferKey(tick.instrument_token, interval, bucketStart);
      
      const existing = this.buffers.get(key);
      
      if (existing) {
        existing.high = Math.max(existing.high, tick.last_price);
        existing.low = Math.min(existing.low, tick.last_price);
        existing.close = tick.last_price;
        existing.volume = tick.volume ?? existing.volume;
        existing.oi = tick.oi ?? existing.oi;
        existing.tickCount++;
      } else {
        this.buffers.set(key, {
          open: tick.last_price,
          high: tick.last_price,
          low: tick.last_price,
          close: tick.last_price,
          volume: tick.volume ?? 0,
          oi: tick.oi ?? 0,
          tickCount: 1,
          firstTickTime: bucketStart,
        });
      }
    }
    
    this.lastProcessedId = tick.id;
  }

  async flushCompletedCandles(): Promise<number> {
    const now = Date.now();
    const completedCandles: AggregatedCandle[] = [];
    const keysToRemove: string[] = [];

    for (const [key, buffer] of this.buffers.entries()) {
      const [tokenStr, intervalStr, bucketStartStr] = key.split(":");
      const instrumentToken = parseInt(tokenStr);
      const interval = parseInt(intervalStr) as IntervalSeconds;
      const bucketStart = parseInt(bucketStartStr);
      
      // Candle is complete if current time is past bucket end
      const bucketEnd = bucketStart + (interval * 1000);
      
      if (now >= bucketEnd) {
        completedCandles.push({
          instrument_token: instrumentToken,
          interval_seconds: interval,
          bucket_start: new Date(bucketStart),
          open: buffer.open,
          high: buffer.high,
          low: buffer.low,
          close: buffer.close,
          volume: buffer.volume,
          oi: buffer.oi,
          tick_count: buffer.tickCount,
        });
        keysToRemove.push(key);
      }
    }

    // Remove flushed candles from buffer
    keysToRemove.forEach(k => this.buffers.delete(k));

    if (completedCandles.length === 0) {
      return 0;
    }

    // Batch insert by interval
    const candles1s = completedCandles.filter(c => c.interval_seconds === 1);
    const candles5s = completedCandles.filter(c => c.interval_seconds === 5);
    const candles15s = completedCandles.filter(c => c.interval_seconds === 15);

    let inserted = 0;

    if (candles1s.length > 0) {
      const rows = candles1s.map(c => ({
        instrument_token: c.instrument_token,
        bucket_start: c.bucket_start.toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        oi: c.oi,
        tick_count: c.tick_count,
      }));
      
      const { error } = await supabaseAdmin
        .from("aggregated_candles_1s")
        .upsert(rows, { onConflict: "instrument_token,bucket_start" });
      
      if (!error) inserted += rows.length;
    }

    if (candles5s.length > 0) {
      const rows = candles5s.map(c => ({
        instrument_token: c.instrument_token,
        bucket_start: c.bucket_start.toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        oi: c.oi,
        tick_count: c.tick_count,
      }));
      
      const { error } = await supabaseAdmin
        .from("aggregated_candles_5s")
        .upsert(rows, { onConflict: "instrument_token,bucket_start" });
      
      if (!error) inserted += rows.length;
    }

    if (candles15s.length > 0) {
      const rows = candles15s.map(c => ({
        instrument_token: c.instrument_token,
        bucket_start: c.bucket_start.toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        oi: c.oi,
        tick_count: c.tick_count,
      }));
      
      const { error } = await supabaseAdmin
        .from("aggregated_candles_15s")
        .upsert(rows, { onConflict: "instrument_token,bucket_start" });
      
      if (!error) inserted += rows.length;
    }

    return inserted;
  }

  async processFromDatabase(batchSize = 1000): Promise<number> {
    // Fetch unprocessed ticks
    let query = supabaseAdmin
      .from("realtime_ticks")
      .select("id, instrument_token, last_price, volume, oi, tick_timestamp")
      .order("tick_timestamp", { ascending: true })
      .limit(batchSize);

    if (this.lastProcessedId) {
      query = query.gt("id", this.lastProcessedId);
    }

    const { data: ticks, error } = await query;

    if (error || !ticks || ticks.length === 0) {
      return 0;
    }

    for (const tick of ticks) {
      this.processTick(tick);
    }

    return ticks.length;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log("[Aggregator] Starting tick aggregation...");

    // Process and flush every 500ms
    this.processInterval = setInterval(async () => {
      try {
        const processed = await this.processFromDatabase();
        const flushed = await this.flushCompletedCandles();
        
        if (processed > 0 || flushed > 0) {
          console.log(`[Aggregator] Processed ${processed} ticks, flushed ${flushed} candles`);
        }
      } catch (error) {
        console.error("[Aggregator] Error:", error);
      }
    }, 500);
  }

  stop(): void {
    this.isRunning = false;
    
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    console.log("[Aggregator] Stopped");
  }

  getStatus(): {
    isRunning: boolean;
    bufferedCandles: number;
    lastProcessedId: string | null;
  } {
    return {
      isRunning: this.isRunning,
      bufferedCandles: this.buffers.size,
      lastProcessedId: this.lastProcessedId,
    };
  }

  // For direct tick processing (called from ticker worker)
  processTickDirect(tick: {
    instrument_token: number;
    last_price: number;
    volume?: number;
    oi?: number;
    timestamp: Date;
  }): void {
    this.processTick({
      id: `direct-${Date.now()}-${tick.instrument_token}`,
      instrument_token: tick.instrument_token,
      last_price: tick.last_price,
      volume: tick.volume ?? null,
      oi: tick.oi ?? null,
      tick_timestamp: tick.timestamp.toISOString(),
    });
  }
}

export const tickAggregator = TickAggregator.getInstance();

// Utility to get aggregated candles for AI scanner
export async function getAggregatedCandles(
  instrumentToken: number,
  interval: 1 | 5 | 15,
  lookbackSeconds: number
): Promise<AggregatedCandle[]> {
  const table = interval === 1 
    ? "aggregated_candles_1s" 
    : interval === 5 
      ? "aggregated_candles_5s" 
      : "aggregated_candles_15s";

  const since = new Date(Date.now() - lookbackSeconds * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("instrument_token", instrumentToken)
    .gte("bucket_start", since)
    .order("bucket_start", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(c => ({
    instrument_token: c.instrument_token,
    interval_seconds: interval,
    bucket_start: new Date(c.bucket_start),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseInt(c.volume),
    oi: parseInt(c.oi),
    tick_count: c.tick_count,
  }));
}

// Utility to check if aggregated data is available
export async function hasRecentAggregatedData(
  instrumentToken: number,
  maxAgeSeconds = 30
): Promise<boolean> {
  const since = new Date(Date.now() - maxAgeSeconds * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("aggregated_candles_1s")
    .select("id")
    .eq("instrument_token", instrumentToken)
    .gte("bucket_start", since)
    .limit(1);

  return !error && data && data.length > 0;
}
