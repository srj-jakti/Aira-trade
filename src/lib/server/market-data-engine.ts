import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

export interface MarketTick {
  instrumentToken: number;
  lastPrice: number;
  lastQuantity?: number;
  averagePrice?: number;
  volume?: number;
  buyQuantity?: number;
  sellQuantity?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  change?: number;
  changePercent?: number;
  lastTradeTime?: Date;
  oi?: number;
  oiDayHigh?: number;
  oiDayLow?: number;
  timestamp: Date;
}

export interface ZerodhaConfig {
  id: string;
  name: string;
  api_key: string;
  api_secret: string;
  user_id?: string;
  password?: string;
  totp_secret?: string;
  access_token: string | null;
  token_expires_at?: string | null;
  auto_login_enabled?: boolean;
  connection_status: string;
  priority: number;
  is_active: boolean;
}

export interface SubscribedInstrument {
  instrumentToken: number;
  tradingsymbol: string;
  mode: "ltp" | "quote" | "full";
}

class MarketDataEngine {
  private static instance: MarketDataEngine;
  private isRunning: boolean = false;
  private activeConfigId: string | null = null;
  private subscribedInstruments: Map<number, SubscribedInstrument> = new Map();
  private tickCallbacks: Set<(tick: MarketTick) => void> = new Set();
  private lastTicks: Map<number, MarketTick> = new Map();
  private ticksPerSecond: number = 0;
  private tickCount: number = 0;
  private lastTickCountReset: number = Date.now();

  private constructor() {}

  static getInstance(): MarketDataEngine {
    if (!MarketDataEngine.instance) {
      MarketDataEngine.instance = new MarketDataEngine();
    }
    return MarketDataEngine.instance;
  }

  async getActiveConfig(): Promise<ZerodhaConfig | null> {
    const { data: configs } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .order("priority", { ascending: true })
      .limit(1);

    if (!configs || configs.length === 0) {
      const { data: anyActive } = await supabaseAdmin
        .from("admin_zerodha_configs")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true })
        .limit(1);
      
      return anyActive?.[0] || null;
    }
    
    return configs[0];
  }

  async getSubscribedInstruments(): Promise<SubscribedInstrument[]> {
    const { data: instruments } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, tradingsymbol, subscription_mode")
      .eq("is_subscribed", true);

    return (instruments || []).map((i) => ({
      instrumentToken: i.instrument_token,
      tradingsymbol: i.tradingsymbol,
      mode: i.subscription_mode as "ltp" | "quote" | "full",
    }));
  }

  async storeTick(tick: MarketTick): Promise<void> {
    await supabaseAdmin.from("realtime_ticks").insert({
      instrument_token: tick.instrumentToken,
      last_price: tick.lastPrice,
      last_quantity: tick.lastQuantity,
      average_price: tick.averagePrice,
      volume: tick.volume,
      buy_quantity: tick.buyQuantity,
      sell_quantity: tick.sellQuantity,
      open: tick.open,
      high: tick.high,
      low: tick.low,
      close: tick.close,
      change: tick.change,
      change_percent: tick.changePercent,
      last_trade_time: tick.lastTradeTime?.toISOString(),
      oi: tick.oi,
      oi_day_high: tick.oiDayHigh,
      oi_day_low: tick.oiDayLow,
      tick_timestamp: tick.timestamp.toISOString(),
    });
  }

  async updateEngineStatus(status: {
    status: string;
    websocketStatus?: string;
    subscribedInstruments?: number;
    lastError?: string;
  }): Promise<void> {
    const now = Date.now();
    if (now - this.lastTickCountReset >= 1000) {
      this.ticksPerSecond = this.tickCount;
      this.tickCount = 0;
      this.lastTickCountReset = now;
    }

    await supabaseAdmin.from("data_engine_status").upsert({
      engine_type: "market_data",
      status: status.status,
      zerodha_config_id: this.activeConfigId,
      websocket_status: status.websocketStatus,
      subscribed_instruments: status.subscribedInstruments || this.subscribedInstruments.size,
      ticks_per_second: this.ticksPerSecond,
      last_tick_at: this.lastTicks.size > 0 ? new Date().toISOString() : null,
      last_error: status.lastError,
      started_at: this.isRunning ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });
  }

  processTick(tick: MarketTick): void {
    this.tickCount++;
    this.lastTicks.set(tick.instrumentToken, tick);
    
    this.tickCallbacks.forEach((callback) => {
      try {
        callback(tick);
      } catch (error) {
        console.error("Error in tick callback:", error);
      }
    });

    this.storeTick(tick).catch(console.error);
  }

  onTick(callback: (tick: MarketTick) => void): () => void {
    this.tickCallbacks.add(callback);
    return () => this.tickCallbacks.delete(callback);
  }

  getLastTick(instrumentToken: number): MarketTick | undefined {
    return this.lastTicks.get(instrumentToken);
  }

  getAllLastTicks(): MarketTick[] {
    return Array.from(this.lastTicks.values());
  }

  getStatus(): {
    isRunning: boolean;
    activeConfigId: string | null;
    subscribedCount: number;
    ticksPerSecond: number;
  } {
    return {
      isRunning: this.isRunning,
      activeConfigId: this.activeConfigId,
      subscribedCount: this.subscribedInstruments.size,
      ticksPerSecond: this.ticksPerSecond,
    };
  }

  setRunning(running: boolean, configId?: string): void {
    this.isRunning = running;
    if (configId) {
      this.activeConfigId = configId;
    }
  }

  setSubscribedInstruments(instruments: SubscribedInstrument[]): void {
    this.subscribedInstruments.clear();
    instruments.forEach((i) => {
      this.subscribedInstruments.set(i.instrumentToken, i);
    });
  }
}

export const marketDataEngine = MarketDataEngine.getInstance();

/**
 * Fetch historical data from Zerodha API
 * NOTE: This is for admin historical data downloads ONLY
 * NOT for live features
 */
export async function fetchHistoricalData(
  instrumentToken: number,
  timeframe: string,
  from: Date,
  to: Date,
  zerodhaConfig?: ZerodhaConfig
): Promise<Array<{
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}>> {
  const config = zerodhaConfig || (await marketDataEngine.getActiveConfig());
  if (!config || !config.access_token) {
    throw new Error("No active Zerodha configuration with valid access token");
  }

  const apiKey = decrypt(config.api_key);
  const accessToken = decrypt(config.access_token);

  const intervalMap: Record<string, string> = {
    "1m": "minute",
    "3m": "3minute",
    "5m": "5minute",
    "10m": "10minute",
    "15m": "15minute",
    "30m": "30minute",
    "1h": "60minute",
    "1d": "day",
  };

  const interval = intervalMap[timeframe] || "day";
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

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
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch historical data");
  }

  const data = await response.json();
  
  return (data.data?.candles || []).map((candle: (string | number)[]) => ({
    timestamp: new Date(candle[0] as string),
    open: candle[1] as number,
    high: candle[2] as number,
    low: candle[3] as number,
    close: candle[4] as number,
    volume: candle[5] as number,
    oi: candle[6] as number | undefined,
  }));
}

/**
 * Store candles to HISTORICAL table
 * Used for admin backtest data downloads ONLY
 * 
 * SAFETY: This writes to historical_candles, NOT live_candles
 */
export async function storeHistoricalCandles(
  instrumentToken: number,
  timeframe: string,
  candles: Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi?: number;
  }>
): Promise<number> {
  if (candles.length === 0) return 0;

  const rows = candles.map((c) => ({
    instrument_token: instrumentToken,
    timeframe,
    timestamp: c.timestamp.toISOString(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    oi: c.oi || 0,
  }));

  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    // SAFETY: Writing to historical_candles for backtest use ONLY
    const { error } = await supabaseAdmin
      .from("historical_candles")
      .upsert(batch, { onConflict: "instrument_token,timeframe,timestamp" });
    
    if (!error) {
      inserted += batch.length;
    }
  }

  return inserted;
}

/**
 * DEPRECATED: Use getCandles from candle-service.ts instead
 * This function is kept for backward compatibility
 * 
 * Get historical candles from HISTORICAL table (for BACKTEST ONLY)
 */
export async function getHistoricalCandles(
  instrumentToken: number,
  timeframe: string,
  from: Date,
  to: Date
): Promise<Array<{
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}>> {
  console.warn(
    "[DEPRECATED] getHistoricalCandles is deprecated. " +
    "Use getCandles({ mode: 'BACKTEST' }) from candle-service.ts instead."
  );

  const { data, error } = await supabaseAdmin
    .from("historical_candles")
    .select("*")
    .eq("instrument_token", instrumentToken)
    .eq("timeframe", timeframe)
    .gte("timestamp", from.toISOString())
    .lte("timestamp", to.toISOString())
    .order("timestamp", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch candles: ${error.message}`);
  }

  return (data || []).map((c) => ({
    timestamp: new Date(c.timestamp),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseInt(c.volume),
    oi: parseInt(c.oi),
  }));
}

export type DataMode = "LIVE" | "BACKTEST";

/**
 * Get live candles from LIVE table (for charts, AI, scanner, auto-trading)
 * 
 * NOTE: For new code, use getCandles({ mode: 'LIVE' }) from candle-service.ts
 */
export async function getLiveCandles(
  instrumentToken: number,
  timeframe: string,
  limit: number = 500
): Promise<Array<{
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}>> {
  // SAFETY: This function ONLY reads from live_candles
  const { data, error } = await supabaseAdmin
    .from("live_candles")
    .select("*")
    .eq("instrument_token", instrumentToken)
    .eq("timeframe", timeframe)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch live candles: ${error.message}`);
  }

  return (data || []).reverse().map((c) => ({
    timestamp: new Date(c.timestamp),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseInt(c.volume) || 0,
    oi: parseInt(c.oi) || 0,
  }));
}

export async function getLatestTick(
  instrumentToken: number
): Promise<MarketTick | null> {
  const { data, error } = await supabaseAdmin
    .from("realtime_ticks")
    .select("*")
    .eq("instrument_token", instrumentToken)
    .order("tick_timestamp", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    instrumentToken: data.instrument_token,
    lastPrice: parseFloat(data.last_price),
    lastQuantity: data.last_quantity ? parseInt(data.last_quantity) : undefined,
    averagePrice: data.average_price ? parseFloat(data.average_price) : undefined,
    volume: data.volume ? parseInt(data.volume) : undefined,
    buyQuantity: data.buy_quantity ? parseInt(data.buy_quantity) : undefined,
    sellQuantity: data.sell_quantity ? parseInt(data.sell_quantity) : undefined,
    open: data.open ? parseFloat(data.open) : undefined,
    high: data.high ? parseFloat(data.high) : undefined,
    low: data.low ? parseFloat(data.low) : undefined,
    close: data.close ? parseFloat(data.close) : undefined,
    change: data.change ? parseFloat(data.change) : undefined,
    changePercent: data.change_percent ? parseFloat(data.change_percent) : undefined,
    lastTradeTime: data.last_trade_time ? new Date(data.last_trade_time) : undefined,
    oi: data.oi ? parseInt(data.oi) : undefined,
    oiDayHigh: data.oi_day_high ? parseInt(data.oi_day_high) : undefined,
    oiDayLow: data.oi_day_low ? parseInt(data.oi_day_low) : undefined,
    timestamp: new Date(data.tick_timestamp),
  };
}

export async function getLatestTicks(
  instrumentTokens: number[]
): Promise<Map<number, MarketTick>> {
  const result = new Map<number, MarketTick>();
  
  if (instrumentTokens.length === 0) return result;

  const { data, error } = await supabaseAdmin
    .from("realtime_ticks")
    .select("*")
    .in("instrument_token", instrumentTokens)
    .order("tick_timestamp", { ascending: false });

  if (error || !data) {
    return result;
  }

  for (const row of data) {
    if (!result.has(row.instrument_token)) {
      result.set(row.instrument_token, {
        instrumentToken: row.instrument_token,
        lastPrice: parseFloat(row.last_price),
        lastQuantity: row.last_quantity ? parseInt(row.last_quantity) : undefined,
        averagePrice: row.average_price ? parseFloat(row.average_price) : undefined,
        volume: row.volume ? parseInt(row.volume) : undefined,
        buyQuantity: row.buy_quantity ? parseInt(row.buy_quantity) : undefined,
        sellQuantity: row.sell_quantity ? parseInt(row.sell_quantity) : undefined,
        open: row.open ? parseFloat(row.open) : undefined,
        high: row.high ? parseFloat(row.high) : undefined,
        low: row.low ? parseFloat(row.low) : undefined,
        close: row.close ? parseFloat(row.close) : undefined,
        change: row.change ? parseFloat(row.change) : undefined,
        changePercent: row.change_percent ? parseFloat(row.change_percent) : undefined,
        lastTradeTime: row.last_trade_time ? new Date(row.last_trade_time) : undefined,
        oi: row.oi ? parseInt(row.oi) : undefined,
        oiDayHigh: row.oi_day_high ? parseInt(row.oi_day_high) : undefined,
        oiDayLow: row.oi_day_low ? parseInt(row.oi_day_low) : undefined,
        timestamp: new Date(row.tick_timestamp),
      });
    }
  }

  return result;
}

/**
 * DEPRECATED: Use getCandles from candle-service.ts instead
 * 
 * Unified candle access with mode enforcement.
 * This function is kept for backward compatibility.
 */
export async function getCandles(options: {
  instrumentToken: number;
  timeframe: string;
  mode: DataMode;
  limit?: number;
  from?: Date;
  to?: Date;
}): Promise<Array<{
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}>> {
  console.warn(
    "[DEPRECATED] getCandles in market-data-engine.ts is deprecated. " +
    "Use getCandles from candle-service.ts instead."
  );

  const { instrumentToken, timeframe, mode, limit = 500, from, to } = options;

  if (mode === "BACKTEST") {
    const fromDate = from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const toDate = to || new Date();
    return getHistoricalCandles(instrumentToken, timeframe, fromDate, toDate);
  } else {
    return getLiveCandles(instrumentToken, timeframe, limit);
  }
}

export async function fetchAndStoreInstruments(
  zerodhaConfig?: ZerodhaConfig
): Promise<number> {
  const config = zerodhaConfig || (await marketDataEngine.getActiveConfig());
  if (!config || !config.access_token) {
    throw new Error("No active Zerodha configuration with valid access token");
  }

  const apiKey = decrypt(config.api_key);
  const accessToken = decrypt(config.access_token);

  const response = await fetch("https://api.kite.trade/instruments", {
    headers: {
      "X-Kite-Version": "3",
      Authorization: `token ${apiKey}:${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch instruments");
  }

  const csvText = await response.text();
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",");

  const instruments = lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i];
    });
    return obj;
  });

  const rows = instruments.map((i) => ({
    instrument_token: parseInt(i.instrument_token),
    exchange_token: parseInt(i.exchange_token),
    tradingsymbol: i.tradingsymbol,
    name: i.name || null,
    exchange: i.exchange,
    segment: i.segment || null,
    instrument_type: i.instrument_type || null,
    tick_size: parseFloat(i.tick_size) || null,
    lot_size: parseInt(i.lot_size) || 1,
    expiry: i.expiry || null,
    strike: parseFloat(i.strike) || null,
  }));

  const batchSize = 5000;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabaseAdmin
      .from("instruments")
      .upsert(batch, { onConflict: "instrument_token" });
    
    if (!error) {
      inserted += batch.length;
    }
  }

  return inserted;
}
