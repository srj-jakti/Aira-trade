import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

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

class MarketDataEngine {
  private static instance: MarketDataEngine;

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
