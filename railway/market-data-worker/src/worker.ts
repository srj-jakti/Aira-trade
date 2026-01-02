/**
 * MARKET DATA WORKER - Railway Deployment
 * 24/7 persistent process that manages:
 * 1. Multi-admin WebSocket connections to Zerodha
 * 2. Tick aggregation (1s/5s/15s candles)
 * 3. Instrument subscription optimization
 * 4. Admin token health monitoring
 * 5. Kill switch compliance
 * 
 * This worker ONLY handles market data.
 * It does NOT evaluate strategies, place orders, or access user-specific data.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { KiteTicker } from "kiteconnect";
import { createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const MAX_INSTRUMENTS_PER_CONNECTION = 3000;
const TICK_FLUSH_INTERVAL = 1000;
const CANDLE_FLUSH_INTERVAL = 500;
const HEALTH_CHECK_INTERVAL = 30000;
const SUBSCRIPTION_REFRESH_INTERVAL = 300000;

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

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[MarketDataWorker] Missing Supabase credentials");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

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
  ticker: any;
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

class MarketDataWorker {
  private connections: Map<string, TickerConnection> = new Map();
  private instrumentAssignments: Map<number, string> = new Map();
  private tickBuffer: Array<Record<string, unknown>> = [];
  private candleBuffers: Map<string, CandleBuffer> = new Map();
  private isRunning = false;
  private isShuttingDown = false;
  private tickFlushInterval: NodeJS.Timeout | null = null;
  private candleFlushInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private subscriptionRefreshInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    console.log("[MarketDataWorker] Starting...");
    console.log(`[MarketDataWorker] Supabase URL: ${supabaseUrl}`);

    await this.logSystemHealth("worker_started", { source: "market_data_worker" }, "info", "Market Data Worker started");

    if (!(await this.isMarketDataEnabled())) {
      console.log("[MarketDataWorker] Market data disabled. Exiting.");
      await this.logSystemHealth("worker_disabled", { reason: "kill_switch" }, "warning", "Market data disabled by kill switch");
      process.exit(0);
    }

    const configs = await this.getActiveAdminConfigs();
    
    if (configs.length === 0) {
      console.error("[MarketDataWorker] No active admin configs found. Entering SAFE MODE.");
      await this.enterSafeMode("No active admin Zerodha configs");
      process.exit(1);
    }

    console.log(`[MarketDataWorker] Found ${configs.length} admin config(s)`);

    for (const config of configs) {
      await this.createConnection(config);
    }

    const connectedCount = Array.from(this.connections.values()).filter(c => c.isConnected).length;
    
    if (connectedCount === 0) {
      console.error("[MarketDataWorker] All connections failed. Entering SAFE MODE.");
      await this.enterSafeMode("All admin WebSocket connections failed");
      process.exit(1);
    }

    this.isRunning = true;

    this.startTickFlush();
    this.startCandleFlush();
    this.startHealthCheck();
    this.startSubscriptionRefresh();

    await this.distributeSubscriptions();

    console.log(`[MarketDataWorker] Running with ${connectedCount}/${configs.length} connections`);
    await this.logSystemHealth("worker_running", { connections: connectedCount, total: configs.length }, "info", `Market Data Worker running with ${connectedCount} connections`);
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
      console.error("[MarketDataWorker] Failed to fetch configs:", error?.message);
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
          console.log(`[MarketDataWorker][${config.name}] Connected`);
          connection.isConnected = true;
          connection.lastHeartbeat = Date.now();
          this.updateConfigStatus(config.id, "connected");
          resolve(true);
        });

        ticker.on("ticks", (ticks: KiteTickData[]) => {
          this.handleTicks(ticks);
          connection.lastHeartbeat = Date.now();
        });

        (ticker as any).on("disconnect", (code: number) => {
          console.log(`[MarketDataWorker][${config.name}] Disconnected: ${code}`);
          connection.isConnected = false;
          this.updateConfigStatus(config.id, "disconnected");
          this.handleConnectionLoss(config.id);
        });

        ticker.on("error", (error: Error) => {
          console.error(`[MarketDataWorker][${config.name}] Error:`, error.message);
          this.updateConfigStatus(config.id, "error", error.message);
        });

        ticker.on("noreconnect", () => {
          console.error(`[MarketDataWorker][${config.name}] Max reconnect attempts reached`);
          connection.isConnected = false;
          this.handleConnectionLoss(config.id);
        });

        ticker.connect();
        this.connections.set(config.id, connection);

        setTimeout(() => {
          if (!connection.isConnected) {
            console.warn(`[MarketDataWorker][${config.name}] Connection timeout`);
            resolve(false);
          }
        }, 30000);

      } catch (error) {
        console.error(`[MarketDataWorker] Error creating connection for ${config.name}:`, error);
        resolve(false);
      }
    });
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
    const intervals = [
      { seconds: 1, label: "1s" },
      { seconds: 5, label: "5s" },
      { seconds: 15, label: "15s" },
      { seconds: 60, label: "1m" },
      { seconds: 300, label: "5m" },
      { seconds: 900, label: "15m" },
    ];

    for (const { seconds, label } of intervals) {
      const bucketStart = Math.floor(tickTime / (seconds * 1000)) * (seconds * 1000);
      const key = `${tick.instrument_token}:${label}:${bucketStart}`;

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
          console.error("[MarketDataWorker] Tick insert error:", error.message);
        }
      } catch (err) {
        console.error("[MarketDataWorker] Tick flush error:", err);
      }
    }, TICK_FLUSH_INTERVAL);
  }

  private startCandleFlush(): void {
    this.candleFlushInterval = setInterval(async () => {
      const now = Date.now();
      const liveCandles: any[] = [];
      const keysToRemove: string[] = [];

      const timeframeSeconds: Record<string, number> = {
        "1s": 1, "5s": 5, "15s": 15, "1m": 60, "5m": 300, "15m": 900
      };

      for (const [key, buffer] of this.candleBuffers.entries()) {
        const [tokenStr, timeframe, bucketStartStr] = key.split(":");
        const instrumentToken = parseInt(tokenStr);
        const bucketStart = parseInt(bucketStartStr);
        const seconds = timeframeSeconds[timeframe] || 1;
        const bucketEnd = bucketStart + (seconds * 1000);

        if (now >= bucketEnd) {
          liveCandles.push({
            instrument_token: instrumentToken,
            timeframe: timeframe,
            timestamp: new Date(bucketStart).toISOString(),
            open: buffer.open,
            high: buffer.high,
            low: buffer.low,
            close: buffer.close,
            volume: buffer.volume,
            oi: buffer.oi,
          });

          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(k => this.candleBuffers.delete(k));

      if (liveCandles.length > 0) {
        const { error } = await supabase.from("live_candles").upsert(liveCandles, { 
          onConflict: "instrument_token,timeframe,timestamp" 
        });
        if (error) {
          console.error("[MarketDataWorker] Live candles upsert error:", error.message);
        }
      }
    }, CANDLE_FLUSH_INTERVAL);
  }

  private async distributeSubscriptions(): Promise<void> {
    const activeConnections = Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.isConnected);

    const maxCapacity = activeConnections.length * MAX_INSTRUMENTS_PER_CONNECTION;
    
    const { data: allInstruments } = await supabase
      .from("instruments")
      .select("instrument_token, tradingsymbol, subscription_mode, subscription_priority, segment")
      .eq("is_subscribed", true)
      .order("subscription_priority", { ascending: true, nullsFirst: false });

    if (!allInstruments || allInstruments.length === 0) {
      console.log("[MarketDataWorker] No instruments to subscribe");
      return;
    }

    let instruments = allInstruments;
    if (allInstruments.length > maxCapacity) {
      console.log(`[MarketDataWorker] ${allInstruments.length} instruments exceed capacity (${maxCapacity}). Prioritizing...`);
      
      const prioritized = [
        ...allInstruments.filter(i => i.segment === "INDICES"),
        ...allInstruments.filter(i => i.subscription_priority === "high"),
        ...allInstruments.filter(i => i.subscription_priority === "user_search"),
        ...allInstruments.filter(i => i.subscription_priority === "auto" && i.segment === "NSE"),
        ...allInstruments.filter(i => i.segment?.includes("NFO")),
      ];

      const seen = new Set<number>();
      instruments = [];
      for (const inst of prioritized) {
        if (!seen.has(inst.instrument_token)) {
          seen.add(inst.instrument_token);
          instruments.push(inst);
          if (instruments.length >= maxCapacity) break;
        }
      }
      
      console.log(`[MarketDataWorker] Selected ${instruments.length} priority instruments`);
    }

    const sortedConnections = activeConnections
      .sort((a, b) => a[1].subscribedTokens.size - b[1].subscribedTokens.size);

    if (sortedConnections.length === 0) {
      console.error("[MarketDataWorker] No active connections for subscription");
      return;
    }

    console.log(`[MarketDataWorker] Distributing ${instruments.length} instruments across ${sortedConnections.length} connections`);

    let connectionIndex = 0;

    for (const instrument of instruments) {
      if (this.instrumentAssignments.has(instrument.instrument_token)) continue;

      for (let i = 0; i < sortedConnections.length; i++) {
        const idx = (connectionIndex + i) % sortedConnections.length;
        const [configId, connection] = sortedConnections[idx];

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
          connectionIndex = (idx + 1) % sortedConnections.length;
          break;
        }
      }
    }

    await this.updateEngineStatus();
  }

  private async handleConnectionLoss(configId: string): Promise<void> {
    const lostConnection = this.connections.get(configId);
    if (!lostConnection) return;

    await this.logSystemHealth("connection_lost", { configId, configName: lostConnection.configName }, "warning", `Connection lost: ${lostConnection.configName}`);

    const tokensToRedistribute = Array.from(lostConnection.subscribedTokens);
    tokensToRedistribute.forEach(t => this.instrumentAssignments.delete(t));
    lostConnection.subscribedTokens.clear();

    const availableConnections = Array.from(this.connections.entries())
      .filter(([id, conn]) => id !== configId && conn.isConnected);

    if (availableConnections.length === 0) {
      const allDown = Array.from(this.connections.values()).every(c => !c.isConnected);
      if (allDown) {
        await this.enterSafeMode("All admin WebSocket connections lost");
      }
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

    console.log(`[MarketDataWorker] Redistributed ${tokensToRedistribute.length} instruments`);
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      if (!(await this.isMarketDataEnabled())) {
        console.log("[MarketDataWorker] Market data disabled. Shutting down.");
        await this.shutdown();
        process.exit(0);
      }

      const now = Date.now();
      for (const [configId, connection] of this.connections.entries()) {
        if (connection.isConnected && (now - connection.lastHeartbeat) > 60000) {
          console.warn(`[MarketDataWorker] Connection ${connection.configName} appears stale`);
          connection.ticker.disconnect();
        }
      }

      await this.updateEngineStatus();
    }, HEALTH_CHECK_INTERVAL);
  }

  private startSubscriptionRefresh(): void {
    this.subscriptionRefreshInterval = setInterval(async () => {
      if (this.isRunning && !this.isShuttingDown) {
        await this.distributeSubscriptions();
      }
    }, SUBSCRIPTION_REFRESH_INTERVAL);
  }

  private async isMarketDataEnabled(): Promise<boolean> {
    const { data } = await supabase
      .from("system_flags")
      .select("flag_value")
      .in("flag_name", ["DISABLE_MARKET_DATA", "SAFE_MODE", "MAINTENANCE_MODE"]);

    if (!data) return true;

    for (const row of data) {
      if (row.flag_value === true || row.flag_value === "true") {
        return false;
      }
    }
    return true;
  }

  private async enterSafeMode(reason: string): Promise<void> {
    console.error(`[MarketDataWorker] ENTERING SAFE MODE: ${reason}`);
    
    await supabase.from("system_flags").upsert({
      flag_name: "SAFE_MODE",
      flag_value: true,
      updated_at: new Date().toISOString(),
      updated_by: "market_data_worker",
      reason,
    }, { onConflict: "flag_name" });

    await this.logSystemHealth("safe_mode_activated", { reason, source: "market_data_worker" }, "critical", `SAFE MODE ACTIVATED: ${reason}`);
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

  private async logSystemHealth(metricType: string, metricValue: unknown, severity: string, message: string): Promise<void> {
    try {
      await supabase.from("system_health_logs").insert({
        metric_type: metricType,
        metric_value: metricValue,
        severity,
        message,
      });
    } catch (err) {
      console.error("[MarketDataWorker] Failed to log system health:", err);
    }
  }

  async shutdown(): Promise<void> {
    console.log("[MarketDataWorker] Shutting down...");
    this.isShuttingDown = true;
    this.isRunning = false;

    if (this.tickFlushInterval) clearInterval(this.tickFlushInterval);
    if (this.candleFlushInterval) clearInterval(this.candleFlushInterval);
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.subscriptionRefreshInterval) clearInterval(this.subscriptionRefreshInterval);

    for (const [_, connection] of this.connections.entries()) {
      try {
        connection.ticker.disconnect();
      } catch (err) {
        console.error("[MarketDataWorker] Error disconnecting:", err);
      }
    }

    this.connections.clear();
    this.instrumentAssignments.clear();

    await supabase.from("data_engine_status").upsert({
      engine_type: "market_data",
      status: "stopped",
      websocket_status: "disconnected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });

    await this.logSystemHealth("worker_stopped", { source: "market_data_worker" }, "info", "Market Data Worker stopped");

    console.log("[MarketDataWorker] Shutdown complete");
  }
}

const worker = new MarketDataWorker();

process.on("SIGINT", async () => {
  console.log("[MarketDataWorker] Received SIGINT");
  await worker.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[MarketDataWorker] Received SIGTERM");
  await worker.shutdown();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("[MarketDataWorker] Uncaught exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[MarketDataWorker] Unhandled rejection:", err);
});

worker.start().catch((err) => {
  console.error("[MarketDataWorker] Fatal error:", err);
  process.exit(1);
});
