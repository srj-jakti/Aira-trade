#!/usr/bin/env node
/**
 * UNIFIED TICKER WORKER
 * Production-ready persistent process that manages:
 * 1. Multi-admin WebSocket connections
 * 2. Tick aggregation (1s/5s/15s candles)
 * 3. Instrument subscription optimization
 * 4. Admin token health monitoring
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { KiteTicker } from "kiteconnect";
import { createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const MAX_INSTRUMENTS_PER_CONNECTION = 3000;
const TICK_FLUSH_INTERVAL = 1000;
const CANDLE_FLUSH_INTERVAL = 500;
const HEALTH_CHECK_INTERVAL = 30000;
const SUBSCRIPTION_REFRESH_INTERVAL = 300000;
const CONNECTION_TIMEOUT = 15000;

function isMarketHours(): { isOpen: boolean; reason: string } {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const day = istTime.getUTCDay();
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  if (day === 0) return { isOpen: false, reason: "Sunday - Market closed" };
  if (day === 6) return { isOpen: false, reason: "Saturday - Market closed" };
  
  const preMarketStart = 9 * 60;
  const marketClose = 15 * 60 + 30;
  
  if (timeInMinutes < preMarketStart) {
    return { isOpen: false, reason: `Pre-market hours (opens at 9:00 AM IST)` };
  }
  if (timeInMinutes > marketClose) {
    return { isOpen: false, reason: `After-market hours (closed at 3:30 PM IST)` };
  }
  
  return { isOpen: true, reason: "Market is open" };
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
  return Buffer.from(key, "hex");
}

function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[Worker] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AdminConfig {
  id: string;
  name: string;
  apiKey: string;
  accessToken: string;
  priority: number;
}

interface TickerConnection {
  configId: string;
  configName: string;
  ticker: KiteTicker;
  isConnected: boolean;
  subscribedTokens: Set<number>;
  lastHeartbeat: number;
}

interface KiteTickData {
  instrument_token: number;
  last_price: number;
  last_quantity?: number;
  average_price?: number;
  volume?: number;
  buy_quantity?: number;
  sell_quantity?: number;
  ohlc?: { open: number; high: number; low: number; close: number };
  change?: number;
  last_trade_time?: Date;
  oi?: number;
  oi_day_high?: number;
  oi_day_low?: number;
}

interface CandleBuffer {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
  tickCount: number;
}

class UnifiedTickerWorker {
  private connections: Map<string, TickerConnection> = new Map();
  private instrumentAssignments: Map<number, string> = new Map();
  private tickBuffer: Array<Record<string, unknown>> = [];
  private candleBuffers: Map<string, CandleBuffer> = new Map();
  private isRunning = false;
  private tickFlushInterval: NodeJS.Timeout | null = null;
  private candleFlushInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private subscriptionRefreshInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    console.log("[Worker] Starting Unified Ticker Worker...");

    const marketStatus = isMarketHours();
    if (!marketStatus.isOpen) {
      console.log(`[Worker] ${marketStatus.reason}`);
      console.log("[Worker] Worker will stay idle and retry when market opens.");
      await this.updateEngineStatusOffline(marketStatus.reason);
      this.waitForMarketOpen();
      return;
    }

    if (!(await this.isMarketDataEnabled())) {
      console.log("[Worker] Market data disabled. Exiting.");
      process.exit(0);
    }

    const configs = await this.getActiveAdminConfigs();
    
    if (configs.length === 0) {
      console.error("[Worker] No active admin configs found.");
      await this.updateEngineStatusOffline("No active admin configs");
      this.waitForMarketOpen();
      return;
    }

    console.log(`[Worker] Found ${configs.length} admin config(s)`);

    for (const config of configs) {
      await this.createConnection(config);
    }

    const connectedCount = Array.from(this.connections.values()).filter(c => c.isConnected).length;
    
    if (connectedCount === 0) {
      const marketCheck = isMarketHours();
      if (!marketCheck.isOpen) {
        console.log(`[Worker] Connections failed but market is closed: ${marketCheck.reason}`);
        await this.updateEngineStatusOffline(marketCheck.reason);
        this.waitForMarketOpen();
        return;
      }
      console.error("[Worker] All connections failed during market hours. Retrying in 60s...");
      await this.updateEngineStatusOffline("Connection failed - retrying");
      setTimeout(() => this.start(), 60000);
      return;
    }

    this.isRunning = true;

    this.startTickFlush();
    this.startCandleFlush();
    this.startHealthCheck();
    this.startSubscriptionRefresh();

    await this.distributeSubscriptions();

    console.log(`[Worker] Running with ${connectedCount}/${configs.length} connections`);
  }

  private async getActiveAdminConfigs(): Promise<AdminConfig[]> {
    const { data: configs, error } = await supabase
      .from("admin_zerodha_configs")
      .select("id, name, api_key, access_token, priority")
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .not("access_token", "is", null)
      .order("priority", { ascending: true });

    if (error || !configs) {
      console.error("[Worker] Failed to fetch configs:", error?.message);
      return [];
    }

    return configs.map(c => ({
      id: c.id,
      name: c.name,
      apiKey: decrypt(c.api_key),
      accessToken: decrypt(c.access_token),
      priority: c.priority || 1,
    }));
  }

  private async createConnection(config: AdminConfig): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ticker = new KiteTicker({
          api_key: config.apiKey,
          access_token: config.accessToken,
        });

        const connection: TickerConnection = {
          configId: config.id,
          configName: config.name,
          ticker,
          isConnected: false,
          subscribedTokens: new Set(),
          lastHeartbeat: Date.now(),
        };

        ticker.autoReconnect(true, 50, 5);

        ticker.on("connect", () => {
          console.log(`[Worker][${config.name}] Connected`);
          connection.isConnected = true;
          connection.lastHeartbeat = Date.now();
          this.updateConfigStatus(config.id, "connected");
          resolve(true);
        });

        ticker.on("ticks", (ticks: KiteTickData[]) => {
          this.handleTicks(ticks);
          connection.lastHeartbeat = Date.now();
        });

        ticker.on("disconnect", (code: number) => {
          console.log(`[Worker][${config.name}] Disconnected: ${code}`);
          connection.isConnected = false;
          this.updateConfigStatus(config.id, "disconnected");
          this.handleConnectionLoss(config.id);
        });

        ticker.on("error", (error: Error) => {
          console.error(`[Worker][${config.name}] Error:`, error.message);
          this.updateConfigStatus(config.id, "error", error.message);
        });

        ticker.on("noreconnect", () => {
          console.error(`[Worker][${config.name}] Max reconnect attempts reached`);
          connection.isConnected = false;
          this.handleConnectionLoss(config.id);
        });

        ticker.connect();
        this.connections.set(config.id, connection);

        setTimeout(() => {
          if (!connection.isConnected) {
            console.warn(`[Worker][${config.name}] Connection timeout`);
            resolve(false);
          }
        }, CONNECTION_TIMEOUT);

      } catch (error) {
        console.error(`[Worker] Error creating connection for ${config.name}:`, error);
        resolve(false);
      }
    });
  }

  private waitForMarketOpen(): void {
    console.log("[Worker] Waiting for market to open...");
    const checkInterval = setInterval(async () => {
      const status = isMarketHours();
      if (status.isOpen) {
        console.log("[Worker] Market is now open! Starting connections...");
        clearInterval(checkInterval);
        await this.start();
      }
    }, 60000);
  }

  private async updateEngineStatusOffline(reason: string): Promise<void> {
    await supabase.from("data_engine_status").upsert({
      engine_type: "market_data",
      status: "idle",
      websocket_status: "market_closed",
      subscribed_instruments: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });
    
    console.log(`[Worker] Engine status: idle (${reason})`);
  }

  private handleTicks(ticks: KiteTickData[]): void {
    const now = new Date().toISOString();

    for (const tick of ticks) {
      this.tickBuffer.push({
        instrument_token: tick.instrument_token,
        last_price: tick.last_price,
        last_quantity: tick.last_quantity || null,
        average_price: tick.average_price || null,
        volume: tick.volume || null,
        buy_quantity: tick.buy_quantity || null,
        sell_quantity: tick.sell_quantity || null,
        open: tick.ohlc?.open || null,
        high: tick.ohlc?.high || null,
        low: tick.ohlc?.low || null,
        close: tick.ohlc?.close || null,
        change: tick.change || null,
        change_percent: tick.ohlc?.close
          ? ((tick.last_price - tick.ohlc.close) / tick.ohlc.close) * 100
          : null,
        last_trade_time: tick.last_trade_time || null,
        oi: tick.oi || null,
        oi_day_high: tick.oi_day_high || null,
        oi_day_low: tick.oi_day_low || null,
        tick_timestamp: now,
      });

      this.updateCandleBuffers(tick, now);
    }
  }

  private updateCandleBuffers(tick: KiteTickData, timestamp: string): void {
    const tickTime = new Date(timestamp).getTime();
    const intervals = [1, 5, 15, 60, 300, 900];

    for (const interval of intervals) {
      const bucketStart = Math.floor(tickTime / (interval * 1000)) * (interval * 1000);
      const key = `${tick.instrument_token}:${interval}:${bucketStart}`;

      const existing = this.candleBuffers.get(key);

      if (existing) {
        existing.high = Math.max(existing.high, tick.last_price);
        existing.low = Math.min(existing.low, tick.last_price);
        existing.close = tick.last_price;
        existing.volume = tick.volume ?? existing.volume;
        existing.oi = tick.oi ?? existing.oi;
        existing.tickCount++;
      } else {
        this.candleBuffers.set(key, {
          open: tick.last_price,
          high: tick.last_price,
          low: tick.last_price,
          close: tick.last_price,
          volume: tick.volume ?? 0,
          oi: tick.oi ?? 0,
          tickCount: 1,
        });
      }
    }
  }

  private startTickFlush(): void {
    this.tickFlushInterval = setInterval(async () => {
      if (this.tickBuffer.length === 0) return;

      const batch = this.tickBuffer.splice(0, 1000);

      try {
        const { error } = await supabase.from("realtime_ticks").insert(batch);
        if (error) {
          console.error("[Worker] Tick insert error:", error.message);
        }
      } catch (err) {
        console.error("[Worker] Tick flush error:", err);
      }
    }, TICK_FLUSH_INTERVAL);
  }

  private startCandleFlush(): void {
    this.candleFlushInterval = setInterval(async () => {
      const now = Date.now();
      const candles1s: any[] = [];
      const candles5s: any[] = [];
      const candles15s: any[] = [];
      const liveCandles: any[] = [];
      const keysToRemove: string[] = [];

      const timeframeMap: Record<number, string> = {
        60: "1m",
        300: "5m",
        900: "15m"
      };

      for (const [key, buffer] of this.candleBuffers.entries()) {
        const [tokenStr, intervalStr, bucketStartStr] = key.split(":");
        const instrumentToken = parseInt(tokenStr);
        const interval = parseInt(intervalStr);
        const bucketStart = parseInt(bucketStartStr);
        const bucketEnd = bucketStart + (interval * 1000);

        if (now >= bucketEnd) {
          const candle = {
            instrument_token: instrumentToken,
            bucket_start: new Date(bucketStart).toISOString(),
            open: buffer.open,
            high: buffer.high,
            low: buffer.low,
            close: buffer.close,
            volume: buffer.volume,
            oi: buffer.oi,
            tick_count: buffer.tickCount,
          };

          if (interval === 1) candles1s.push(candle);
          else if (interval === 5) candles5s.push(candle);
          else if (interval === 15) candles15s.push(candle);

          if (timeframeMap[interval]) {
            liveCandles.push({
              instrument_token: instrumentToken,
              timeframe: timeframeMap[interval],
              timestamp: new Date(bucketStart).toISOString(),
              open: buffer.open,
              high: buffer.high,
              low: buffer.low,
              close: buffer.close,
              volume: buffer.volume,
              oi: buffer.oi,
              updated_at: new Date().toISOString()
            });
          }

          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(k => this.candleBuffers.delete(k));

      if (candles1s.length > 0) {
        await supabase.from("aggregated_candles_1s").upsert(candles1s, { onConflict: "instrument_token,bucket_start" });
      }
      if (candles5s.length > 0) {
        await supabase.from("aggregated_candles_5s").upsert(candles5s, { onConflict: "instrument_token,bucket_start" });
      }
      if (candles15s.length > 0) {
        await supabase.from("aggregated_candles_15s").upsert(candles15s, { onConflict: "instrument_token,bucket_start" });
      }
      if (liveCandles.length > 0) {
        await supabase.from("live_candles").upsert(liveCandles, { onConflict: "instrument_token,timeframe,timestamp" });
      }
    }, CANDLE_FLUSH_INTERVAL);
  }

  private async distributeSubscriptions(): Promise<void> {
    const { data: instruments } = await supabase
      .from("instruments")
      .select("instrument_token, tradingsymbol, subscription_mode")
      .eq("is_subscribed", true);

    if (!instruments || instruments.length === 0) {
      console.log("[Worker] No instruments to subscribe");
      return;
    }

    const activeConnections = Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.isConnected)
      .sort((a, b) => a[1].subscribedTokens.size - b[1].subscribedTokens.size);

    if (activeConnections.length === 0) {
      console.error("[Worker] No active connections for subscription");
      return;
    }

    console.log(`[Worker] Distributing ${instruments.length} instruments across ${activeConnections.length} connections`);

    let connectionIndex = 0;

    for (const instrument of instruments) {
      if (this.instrumentAssignments.has(instrument.instrument_token)) continue;

      for (let i = 0; i < activeConnections.length; i++) {
        const idx = (connectionIndex + i) % activeConnections.length;
        const [configId, connection] = activeConnections[idx];

        if (connection.subscribedTokens.size < MAX_INSTRUMENTS_PER_CONNECTION) {
          connection.ticker.subscribe([instrument.instrument_token]);
          
          const mode = instrument.subscription_mode === "ltp"
            ? connection.ticker.modeLTP
            : instrument.subscription_mode === "full"
              ? connection.ticker.modeFull
              : connection.ticker.modeQuote;
          
          connection.ticker.setMode(mode, [instrument.instrument_token]);
          connection.subscribedTokens.add(instrument.instrument_token);
          this.instrumentAssignments.set(instrument.instrument_token, configId);
          connectionIndex = (idx + 1) % activeConnections.length;
          break;
        }
      }
    }

    await this.updateEngineStatus();
  }

  private async handleConnectionLoss(configId: string): Promise<void> {
    const lostConnection = this.connections.get(configId);
    if (!lostConnection) return;

    const tokensToRedistribute = Array.from(lostConnection.subscribedTokens);
    tokensToRedistribute.forEach(t => this.instrumentAssignments.delete(t));
    lostConnection.subscribedTokens.clear();

    const availableConnections = Array.from(this.connections.entries())
      .filter(([id, conn]) => id !== configId && conn.isConnected);

    if (availableConnections.length === 0) {
      console.warn("[Worker] All connections lost. Waiting for reconnect...");
      return;
    }

    let idx = 0;
    for (const token of tokensToRedistribute) {
      const [targetId, targetConn] = availableConnections[idx % availableConnections.length];
      targetConn.ticker.subscribe([token]);
      targetConn.ticker.setMode(targetConn.ticker.modeQuote, [token]);
      targetConn.subscribedTokens.add(token);
      this.instrumentAssignments.set(token, targetId);
      idx++;
    }

    console.log(`[Worker] Redistributed ${tokensToRedistribute.length} instruments`);
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!(await this.isMarketDataEnabled())) {
        console.log("[Worker] Market data disabled. Shutting down.");
        await this.shutdown();
        process.exit(0);
      }

      const now = Date.now();
      for (const [configId, connection] of this.connections.entries()) {
        if (connection.isConnected && (now - connection.lastHeartbeat) > 60000) {
          console.warn(`[Worker] Connection ${connection.configName} appears stale`);
          connection.ticker.disconnect();
        }
      }

      await this.updateEngineStatus();
    }, HEALTH_CHECK_INTERVAL);
  }

  private startSubscriptionRefresh(): void {
    this.subscriptionRefreshInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.distributeSubscriptions();
      }
    }, SUBSCRIPTION_REFRESH_INTERVAL);
  }

  private async isMarketDataEnabled(): Promise<boolean> {
    const { data } = await supabase
      .from("system_flags")
      .select("flag_value")
      .in("flag_name", ["DISABLE_MARKET_DATA", "MAINTENANCE_MODE"]);

    if (!data) return true;

    for (const row of data) {
      if (row.flag_value === true || row.flag_value === "true") {
        return false;
      }
    }
    return true;
  }

  private async updateConfigStatus(configId: string, status: string, error?: string): Promise<void> {
    await supabase
      .from("admin_zerodha_configs")
      .update({
        connection_status: status,
        last_error: error || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);
  }

  private async updateEngineStatus(): Promise<void> {
    const totalSubscribed = Array.from(this.connections.values())
      .reduce((sum, c) => sum + c.subscribedTokens.size, 0);

    const connectedCount = Array.from(this.connections.values())
      .filter(c => c.isConnected).length;

    await supabase.from("data_engine_status").upsert({
      engine_type: "market_data",
      status: this.isRunning ? "running" : "stopped",
      websocket_status: connectedCount > 0 ? "connected" : "disconnected",
      subscribed_instruments: totalSubscribed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });
  }

  async shutdown(): Promise<void> {
    console.log("[Worker] Shutting down...");
    this.isRunning = false;

    if (this.tickFlushInterval) clearInterval(this.tickFlushInterval);
    if (this.candleFlushInterval) clearInterval(this.candleFlushInterval);
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.subscriptionRefreshInterval) clearInterval(this.subscriptionRefreshInterval);

    for (const [_, connection] of this.connections.entries()) {
      connection.ticker.disconnect();
    }

    this.connections.clear();
    this.instrumentAssignments.clear();

    await supabase.from("data_engine_status").upsert({
      engine_type: "market_data",
      status: "stopped",
      websocket_status: "disconnected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });

    console.log("[Worker] Shutdown complete");
  }
}

const worker = new UnifiedTickerWorker();

process.on("SIGINT", async () => {
  await worker.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await worker.shutdown();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("[Worker] Uncaught exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[Worker] Unhandled rejection:", err);
});

worker.start().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
