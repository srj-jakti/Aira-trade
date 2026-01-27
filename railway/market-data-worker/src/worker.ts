/**
 * MARKET DATA WORKER - Multi-API-Key Architecture
 * 
 * Manages multiple Zerodha API keys with tier-based subscription allocation:
 * - API KEY A (CORE): NIFTY, BANKNIFTY, FINNIFTY, SENSEX, NIFTY50 stocks, index options
 * - API KEY B (SCANNER): Strategy instruments, Scanner instruments - NEVER auto-cleaned
 * - API KEY C (TEMP): User on-demand requests (Strategy/Analysis pages) - 5-min cleanup
 * 
 * Data Flow:
 * - Scanner + AI Trading: 24/7 data feed via SCANNER tier (runs even when users logged out)
 * - Strategy/Analysis: On-demand via TEMP tier (cleaned when user leaves)
 * 
 * LIVE-HISTORICAL DATA:
 * - Backfills live_candles from Zerodha Historical API on startup
 * - Maintains rolling recent history per retention policy
 * - WebSocket aggregation for real-time candle updates
 * 
 * Safety constraints:
 * - MAX 3000 instruments per WebSocket (Zerodha hard limit)
 * - SOFT LIMIT 2500 instruments (buffer zone)
 * - 1 primary + 1 fallback WebSocket per API key
 * - Fallback WebSocket ONLY for TEMP tier under pressure
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { KiteTicker } from "kiteconnect";
import { createDecipheriv } from "crypto";
import { 
  SubscriptionManager, 
  ApiKeyConfig, 
  SubscriptionTier,
  SubscriptionRequest 
} from "./subscription-manager";
import { BackfillService } from "./backfill-service";
import { TechnicalIndicators } from "./utils/indicators";
import { redis, REDIS_KEYS, scheduleMarketCloseCleanup, cleanupDayEndData } from "./utils/redis";

const ALGORITHM = "aes-256-gcm";
const MAX_INSTRUMENTS_PER_CONNECTION = 3000;
const TICK_FLUSH_INTERVAL = 5000;
const CANDLE_FLUSH_INTERVAL = 5000;
const HEALTH_CHECK_INTERVAL = 30000;
const SUBSCRIPTION_REFRESH_INTERVAL = 300000;
const BACKFILL_CHECK_INTERVAL = 3600000; // 1 hour

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

interface WebSocketConnection {
  id: string;
  apiKeyId: string;
  ticker: any;
  isConnected: boolean;
  lastHeartbeat: number;
}

class MarketDataWorker {
  private subscriptionManager: SubscriptionManager;
  private connections: Map<string, WebSocketConnection> = new Map();
  private apiKeyConfigs: Map<string, ApiKeyConfig> = new Map();
  private tickBuffer: Array<Record<string, unknown>> = [];
  private candleBuffers: Map<string, CandleBuffer> = new Map();
  public isRunning = false;
  private isShuttingDown = false;
  private tickCount = 0;
  private ticksPerSecond = 0;
  private lastTickAt: string | null = null;
  private lastTickCountReset = Date.now();
  private tickFlushInterval: NodeJS.Timeout | null = null;
  private candleFlushInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private subscriptionRefreshInterval: NodeJS.Timeout | null = null;
  private backfillCheckInterval: NodeJS.Timeout | null = null;
  private pendingSubscriptionRequests: SubscriptionRequest[] = [];
  private backfillService: BackfillService | null = null;
  private priceHistory: Map<string, number[]> = new Map();
  private indicatorStates: Map<string, any> = new Map();

    constructor() {
      this.subscriptionManager = new SubscriptionManager(supabase);
      this.subscriptionManager.setFallbackDestroyCallback((wsId) => {
        this.destroyFallbackConnection(wsId);
      });
    }

    private destroyFallbackConnection(websocketId: string): void {
      const conn = this.connections.get(websocketId);
      if (conn) {
        console.log(`[MarketDataWorker] Destroying ephemeral fallback ${websocketId}`);
        try {
          conn.ticker.disconnect();
        } catch (e) {}
        this.connections.delete(websocketId);
      }
    }

  async start(): Promise<void> {
    console.log("[MarketDataWorker] Starting Multi-API-Key Architecture...");
    console.log(`[MarketDataWorker] Supabase URL: ${supabaseUrl}`);
    console.log(`[MarketDataWorker] Redis URL: ${process.env.REDIS_URL ? "configured" : "NOT SET"}`);

    await this.logSystemHealth("worker_started", { source: "market_data_worker", architecture: "multi_api_key" }, "info", "Market Data Worker started (Multi-API-Key)");

    scheduleMarketCloseCleanup();
    console.log("[MarketDataWorker] Day-end Redis cleanup scheduler initialized");

    while (!(await this.isMarketDataEnabled())) {
      console.log("[MarketDataWorker] Market data disabled. Waiting for enable signal (polling every 30s)...");
      await this.logSystemHealth("worker_waiting", { reason: "disabled" }, "info", "Market data disabled - worker waiting for enable");
      await new Promise(resolve => setTimeout(resolve, 30000));
      if (getShutdownFlag()) {
        console.log("[MarketDataWorker] Shutdown requested while waiting.");
        return;
      }
    }
    
    console.log("[MarketDataWorker] Market data enabled. Proceeding with initialization...");

    const configs = await this.getApiKeyConfigs();
    
    if (configs.length === 0) {
      console.error("[MarketDataWorker] No API key configs found. Using legacy mode.");
      const legacyConfigs = await this.getLegacyAdminConfigs();
      if (legacyConfigs.length === 0) {
        await this.enterSafeMode("No Zerodha API configs available");
        console.log("[MarketDataWorker] No configs available. Staying alive for heartbeat...");
        return; // Don't exit, let heartbeat keep running
      }
      for (const c of legacyConfigs) {
        configs.push({
          id: c.id,
          tierAssignment: "CORE" as SubscriptionTier,
          zerodhaConfigId: c.id,
          apiKey: c.apiKey,
          accessToken: c.accessToken,
          name: c.name,
        });
      }
    }

    console.log(`[MarketDataWorker] Found ${configs.length} API key config(s)`);

    // Initialize backfill service with first available config
    if (configs.length > 0) {
      this.backfillService = new BackfillService(
        supabase,
        configs[0].apiKey,
        configs[0].accessToken
      );
      console.log("[MarketDataWorker] Backfill service initialized");
    }

    await this.subscriptionManager.initialize(configs);

    for (const config of configs) {
      this.apiKeyConfigs.set(config.id, config);
      await this.createPrimaryConnection(config);
    }

    const connectedCount = Array.from(this.connections.values()).filter(c => c.isConnected).length;
    
      if (connectedCount === 0) {
        console.error("[MarketDataWorker] All connections failed. Will retry in next heartbeat cycle.");
        await this.logSystemHealth("connection_failed", { reason: "All connections failed" }, "warning", "All WebSocket connections failed - will retry");
        return; // Don't exit, let heartbeat retry
      }

    this.isRunning = true;

    this.startTickFlush();
    this.startCandleFlush();
    this.startHealthCheck();
    this.startSubscriptionRefresh();
    this.startSubscriptionRequestHandler();
    this.startBackfillChecker();

    await this.subscribeToCore();

      // Subscribe to SCANNER tier instruments (strategies + scanner)
      await this.subscribeToScanner();

      // Run initial backfill for CORE instruments
      if (this.backfillService) {
        console.log("[MarketDataWorker] Starting initial Live-Historical backfill...");
        this.backfillService.backfillCoreInstruments().catch((err) => {
          console.error("[MarketDataWorker] Initial backfill failed:", err);
        });
      }

    console.log(`[MarketDataWorker] Running with ${connectedCount}/${configs.length} connections`);
    await this.logSystemHealth("worker_running", { connections: connectedCount, total: configs.length }, "info", `Market Data Worker running with ${connectedCount} connections`);
  }

  private async getApiKeyConfigs(): Promise<ApiKeyConfig[]> {
    console.log("[MarketDataWorker] Fetching api_key_configs...");
    
    // First try api_key_configs table, but gracefully handle if it doesn't exist
    let apiKeyData: any[] | null = null;
    try {
      const { data, error: apiKeyError } = await supabase
        .from("api_key_configs")
        .select("id, label, tier_assignment, zerodha_config_id")
        .eq("is_active", true);
      
      if (!apiKeyError) {
        apiKeyData = data;
      } else if (!apiKeyError.message?.includes("does not exist")) {
        console.error("[MarketDataWorker] Error fetching api_key_configs:", apiKeyError);
      }
    } catch (e) {
      console.log("[MarketDataWorker] api_key_configs table not found, using legacy mode");
    }
    
    console.log(`[MarketDataWorker] Found ${apiKeyData?.length || 0} active api_key_configs`);

    if (!apiKeyData || apiKeyData.length === 0) {
      console.log("[MarketDataWorker] No api_key_configs found, using legacy admin configs...");
      return [];
    }

    const configs: ApiKeyConfig[] = [];

    for (const akc of apiKeyData) {
      console.log(`[MarketDataWorker] Fetching Zerodha config for ${akc.label} (ID: ${akc.zerodha_config_id})...`);
      const { data: zerodhaConfig, error: zError } = await supabase
        .from("admin_zerodha_configs")
        .select("id, name, api_key, access_token")
        .eq("id", akc.zerodha_config_id)
        .eq("is_active", true)
        .eq("connection_status", "connected")
        .single();

      if (zError) {
        console.warn(`[MarketDataWorker] Zerodha config ${akc.zerodha_config_id} not found or not connected:`, zError.message);
        continue;
      }

      if (zerodhaConfig && zerodhaConfig.access_token) {
        try {
          console.log(`[MarketDataWorker] Decrypting keys for ${zerodhaConfig.name}...`);
          configs.push({
            id: akc.id,
            tierAssignment: akc.tier_assignment as SubscriptionTier,
            zerodhaConfigId: zerodhaConfig.id,
            apiKey: decrypt(zerodhaConfig.api_key),
            accessToken: decrypt(zerodhaConfig.access_token),
            name: zerodhaConfig.name,
          });
        } catch (e) {
          console.error(`[MarketDataWorker] Failed to decrypt config ${akc.id}:`, e);
        }
      }
    }

    return configs;
  }

  private async getLegacyAdminConfigs(): Promise<{ id: string; name: string; apiKey: string; accessToken: string }[]> {
    const now = new Date().toISOString();
    
    const { data: configs, error } = await supabase
      .from("admin_zerodha_configs")
      .select("id, name, api_key, access_token, token_expires_at")
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .not("access_token", "is", null)
      .gte("token_expires_at", now); // Only get configs with non-expired tokens

    if (error || !configs) {
      console.error("[MarketDataWorker] Failed to fetch legacy configs:", error?.message);
      return [];
    }

    if (configs.length === 0) {
      console.warn("[MarketDataWorker] No admin configs with valid tokens found. All tokens may be expired.");
    }

    return configs.map(c => ({
      id: c.id,
      name: c.name,
      apiKey: decrypt(c.api_key),
      accessToken: decrypt(c.access_token),
    }));
  }

  private async createPrimaryConnection(config: ApiKeyConfig): Promise<boolean> {
    const websocketId = `${config.id}_primary`;
    return this.createConnection(config, websocketId);
  }

  private async createFallbackConnection(config: ApiKeyConfig): Promise<boolean> {
    const websocketId = `${config.id}_fallback`;
    console.log(`[MarketDataWorker] Creating FALLBACK WebSocket for ${config.name}`);
    return this.createConnection(config, websocketId);
  }

  private createConnection(config: ApiKeyConfig, websocketId: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ticker = new KiteTicker({
          api_key: config.apiKey,
          access_token: config.accessToken,
        });

        const connection: WebSocketConnection = {
          id: websocketId,
          apiKeyId: config.id,
          ticker,
          isConnected: false,
          lastHeartbeat: Date.now(),
        };

        ticker.autoReconnect(true, 50, 5);

        ticker.on("connect", async () => {
          console.log(`[MarketDataWorker][${websocketId}] Connected`);
          connection.isConnected = true;
          connection.lastHeartbeat = Date.now();
          this.subscriptionManager.setWebSocketConnected(websocketId, true);
          
          await this.resubscribeTokens(websocketId);
          resolve(true);
        });

        ticker.on("ticks", (ticks: KiteTickData[]) => {
          this.handleTicks(ticks);
          connection.lastHeartbeat = Date.now();
        });

        ticker.on("disconnect", (code: number) => {
          console.log(`[MarketDataWorker][${websocketId}] Disconnected: ${code}`);
          connection.isConnected = false;
          this.subscriptionManager.setWebSocketConnected(websocketId, false);
        });

        ticker.on("error", (error: Error) => {
          console.error(`[MarketDataWorker][${websocketId}] Error:`, error.message);
        });

        ticker.on("noreconnect", () => {
          console.error(`[MarketDataWorker][${websocketId}] Max reconnect attempts reached`);
          connection.isConnected = false;
          this.subscriptionManager.setWebSocketConnected(websocketId, false);
        });

        ticker.connect();
        this.connections.set(websocketId, connection);

        setTimeout(() => {
          if (!connection.isConnected) {
            console.warn(`[MarketDataWorker][${websocketId}] Connection timeout`);
            resolve(false);
          }
        }, 30000);

      } catch (error) {
        console.error(`[MarketDataWorker] Error creating connection ${websocketId}:`, error);
        resolve(false);
      }
    });
  }

  private async resubscribeTokens(websocketId: string): Promise<void> {
      const connection = this.connections.get(websocketId);
      if (!connection) return;

      const { core, scanner, temp } = this.subscriptionManager.getTokensForResubscription(websocketId);
      const totalTokens = core.length + scanner.length + temp.length;

      if (totalTokens === 0) return;

      console.log(`[MarketDataWorker][${websocketId}] Resubscribing ${totalTokens} tokens in PRIORITY ORDER (CORE: ${core.length}, SCANNER: ${scanner.length}, TEMP: ${temp.length})`);

      const subscribeChunks = async (tokens: number[], tier: string) => {
        if (tokens.length === 0) return;
        console.log(`[MarketDataWorker][${websocketId}] Subscribing ${tier}: ${tokens.length} tokens`);
        
        for (let i = 0; i < tokens.length; i += 500) {
          const chunk = tokens.slice(i, i + 500);
          connection.ticker.subscribe(chunk);
          connection.ticker.setMode(connection.ticker.modeQuote, chunk);
          await new Promise(r => setTimeout(r, 100));
        }
      };

      await subscribeChunks(core, "CORE");
      await subscribeChunks(scanner, "SCANNER");
      await subscribeChunks(temp, "TEMP");
    }

  private async subscribeToCore(): Promise<void> {
    console.log("[MarketDataWorker] Subscribing to CORE instruments...");
    
    const results = await this.subscriptionManager.subscribeCore();
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[MarketDataWorker] CORE subscription complete: ${success} success, ${failed} failed`);

    for (const result of results) {
      if (result.success && result.websocketId) {
        const conn = this.connections.get(result.websocketId);
        if (conn && conn.isConnected) {
          conn.ticker.subscribe([result.instrumentToken]);
          conn.ticker.setMode(conn.ticker.modeQuote, [result.instrumentToken]);
        }
      }
    }

    await this.updateEngineStatus();
  }

  private async subscribeToScanner(): Promise<void> {
    console.log("[MarketDataWorker] Subscribing to SCANNER instruments (strategies + scanner)...");
    
    const results = await this.subscriptionManager.subscribeScannerInstruments();
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[MarketDataWorker] SCANNER subscription complete: ${success} success, ${failed} failed`);

    for (const result of results) {
      if (result.success && result.websocketId) {
        const conn = this.connections.get(result.websocketId);
        if (conn && conn.isConnected) {
          conn.ticker.subscribe([result.instrumentToken]);
          conn.ticker.setMode(conn.ticker.modeQuote, [result.instrumentToken]);
        }
      }
    }

    // Queue backfill for SCANNER instruments
    if (this.backfillService) {
      for (const result of results) {
        if (result.success) {
          this.backfillService.queueBackfill(result.instrumentToken, "5m");
          this.backfillService.queueBackfill(result.instrumentToken, "15m");
        }
      }
    }

    await this.updateEngineStatus();
  }

  async subscribeInstrument(request: SubscriptionRequest): Promise<boolean> {
    const result = await this.subscriptionManager.subscribe(request);
    
    if (result.success && result.websocketId) {
      let conn = this.connections.get(result.websocketId);

      if (!conn && result.websocketId.endsWith("_fallback")) {
        const config = this.apiKeyConfigs.get(result.apiKeyId!);
        if (config) {
          const created = await this.createFallbackConnection(config);
          if (created) {
            conn = this.connections.get(result.websocketId);
          }
        }
      }

      if (conn && conn.isConnected) {
        conn.ticker.subscribe([request.instrumentToken]);
        conn.ticker.setMode(conn.ticker.modeQuote, [request.instrumentToken]);
        
        // Queue for Live-Historical backfill
        if (this.backfillService) {
          this.backfillService.queueBackfill(request.instrumentToken, "5m");
          this.backfillService.queueBackfill(request.instrumentToken, "15m");
        }
        
        return true;
      }
    }

    return result.success;
  }

  async unsubscribeInstrument(instrumentToken: number): Promise<boolean> {
    const tokens = this.subscriptionManager.getAllSubscribedTokens();
    const sub = tokens.includes(instrumentToken);
    
    if (!sub) return false;

    for (const [wsId, conn] of this.connections.entries()) {
      if (conn.isConnected) {
        try {
          conn.ticker.unsubscribe([instrumentToken]);
        } catch (e) {
        }
      }
    }

    return await this.subscriptionManager.unsubscribe(instrumentToken);
  }

  private startSubscriptionRequestHandler(): void {
    const channel = supabase
      .channel("subscription_requests")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "subscription_requests",
      }, async (payload) => {
        const { instrument_token, tier, source } = payload.new as any;
        await this.subscribeInstrument({
          instrumentToken: instrument_token,
          tier: tier as SubscriptionTier,
          source,
        });
      })
      .subscribe();

    console.log("[MarketDataWorker] Listening for subscription requests");
  }

  private handleTicks(ticks: KiteTickData[]): void {
    const now = new Date().toISOString();
    this.tickCount += ticks.length;
    this.lastTickAt = now;

    if (this.tickCount % 100 === 0) {
      console.log(`[MarketDataWorker] Received ${this.tickCount} ticks since start. Last at ${now}`);
    }

    for (const tick of ticks) {
      this.subscriptionManager.touchSubscription(tick.instrument_token);

      // Publish to Redis Pub/Sub for immediate AI reaction
      const redisPayload = JSON.stringify({
        token: tick.instrument_token,
        price: tick.last_price,
        timestamp: now,
      });
      redis.publish(REDIS_KEYS.TICK_CHANNEL(tick.instrument_token), redisPayload);
      redis.set(REDIS_KEYS.LATEST_TICK(tick.instrument_token), redisPayload, "EX", 3600);

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
      { seconds: 3600, label: "1h" }, // Added 1h for Live-Historical
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
        "1s": 1, "5s": 5, "15s": 15, "1m": 60, "5m": 300, "15m": 900, "1h": 3600
      };

        for (const [key, buffer] of this.candleBuffers.entries()) {
          const [tokenStr, timeframe, bucketStartStr] = key.split(":");
          const instrumentToken = parseInt(tokenStr);
          const bucketStart = parseInt(bucketStartStr);
          const seconds = timeframeSeconds[timeframe] || 1;
          const bucketEnd = bucketStart + (seconds * 1000);

          const historyKey = `${instrumentToken}:${timeframe}`;
          const history = this.priceHistory.get(historyKey) || [];
          
          // Calculate indicators
          const indicators: any = {};
          if (history.length > 0) {
            const currentPrices = [...history, buffer.close];
            indicators.ema_20 = TechnicalIndicators.calculateEMA(buffer.close, history[history.length - 1], 20);
            indicators.rsi_14 = TechnicalIndicators.calculateRSI(currentPrices, 14);
          }

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
              indicators: indicators
            });

            // Push live candle update to Redis
            const candlePayload = JSON.stringify({
              token: instrumentToken,
              timeframe,
              bucketStart,
              open: buffer.open,
              high: buffer.high,
              low: buffer.low,
              close: buffer.close,
              indicators
            });
            redis.publish(REDIS_KEYS.CANDLE_CHANNEL(instrumentToken, timeframe), candlePayload);
            redis.set(REDIS_KEYS.LIVE_CANDLE(instrumentToken, timeframe), candlePayload, "EX", 3600);

            if (now >= bucketEnd) {
              // Candle is closing, push to Redis List for history
              const listKey = REDIS_KEYS.CANDLE_LIST(instrumentToken, timeframe);
              redis.rpush(listKey, candlePayload);
              redis.ltrim(listKey, -100, -1); // Keep last 100 candles
              redis.expire(listKey, 86400); // 24 hours expiry

              // Candle is closing, add to history

            history.push(buffer.close);
            if (history.length > 50) history.shift(); // Keep last 50
            this.priceHistory.set(historyKey, history);
            keysToRemove.push(key);
          }
        }


      keysToRemove.forEach(k => this.candleBuffers.delete(k));

      if (liveCandles.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < liveCandles.length; i += chunkSize) {
          const chunk = liveCandles.slice(i, i + chunkSize);
          const { error } = await supabase.from("live_candles").upsert(chunk, { 
            onConflict: "instrument_token,timeframe,timestamp" 
          });
          if (error) {
            console.error("[MarketDataWorker] Live candles upsert error:", error.message);
          }
        }
      }
    }, CANDLE_FLUSH_INTERVAL);
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      if (!(await this.isMarketDataEnabled())) {
        console.log("[MarketDataWorker] Market data disabled. Pausing operations (will resume when re-enabled)...");
        this.isRunning = false;
        await this.updateEngineStatus();
        return;
      }
      
      if (!this.isRunning) {
        console.log("[MarketDataWorker] Market data re-enabled. Resuming operations...");
        this.isRunning = true;
      }

      const now = Date.now();
      for (const [wsId, connection] of this.connections.entries()) {
        if (connection.isConnected && (now - connection.lastHeartbeat) > 60000) {
          console.warn(`[MarketDataWorker] Connection ${wsId} appears stale, reconnecting...`);
          connection.ticker.disconnect();
        }
      }

      for (const [apiKeyId, config] of this.apiKeyConfigs.entries()) {
        if (this.subscriptionManager.needsFallbackWebSocket(apiKeyId)) {
          if (!this.connections.has(`${apiKeyId}_fallback`)) {
            await this.createFallbackConnection(config);
          }
        }
      }

      await this.subscriptionManager.cleanupInactiveSubscriptions();

      await this.updateEngineStatus();

      const stats = this.subscriptionManager.getStats();
      console.log(`[MarketDataWorker] Stats: ${stats.totalSubscriptions} subscriptions (CORE: ${stats.byTier.CORE}, SCANNER: ${stats.byTier.SCANNER}, TEMP: ${stats.byTier.TEMP})`);
    }, HEALTH_CHECK_INTERVAL);
  }

  private startSubscriptionRefresh(): void {
    this.subscriptionRefreshInterval = setInterval(async () => {
      if (this.isRunning && !this.isShuttingDown) {
        // Refresh SCANNER tier from scanner_instruments and active_trade_instruments
        await this.subscribeToScanner();

        // Also handle legacy high-priority instruments
        const { data: popular } = await supabase
          .from("instruments")
          .select("instrument_token")
          .eq("is_subscribed", true)
          .eq("subscription_priority", "high")
          .limit(1000);

        if (popular) {
          for (const inst of popular) {
            await this.subscribeInstrument({
              instrumentToken: inst.instrument_token,
              tier: "SCANNER",
              source: "subscription_refresh",
            });
          }
        }
      }
    }, SUBSCRIPTION_REFRESH_INTERVAL);
  }

  /**
   * Periodically check for instruments needing Live-Historical backfill
   */
  private startBackfillChecker(): void {
    this.backfillCheckInterval = setInterval(async () => {
      if (!this.backfillService || this.isShuttingDown) return;

      try {
        // Process any queued backfill requests
        await this.backfillService.processQueue();

        // Clean up old data beyond retention
        await this.backfillService.cleanupOldData();
      } catch (err) {
        console.error("[MarketDataWorker] Backfill check error:", err);
      }
    }, BACKFILL_CHECK_INTERVAL);

    // Also run every 5 minutes for queue processing
    setInterval(async () => {
      if (this.backfillService && !this.isShuttingDown) {
        await this.backfillService.processQueue();
      }
    }, 300000);
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

  private async updateEngineStatus(): Promise<void> {
    const stats = this.subscriptionManager.getStats();
    const connectedCount = Array.from(this.connections.values()).filter(c => c.isConnected).length;

    const now = Date.now();
    if (now - this.lastTickCountReset >= 1000) {
      this.ticksPerSecond = this.tickCount;
      this.tickCount = 0;
      this.lastTickCountReset = now;
    }

    await supabase.from("trading_engine_status").upsert({
      engine_type: "market_data",
      status: this.isRunning ? "running" : "stopped",
      last_heartbeat: new Date().toISOString(),
      active_users: stats.totalSubscriptions,
      evaluations_last_minute: this.ticksPerSecond,
      error_message: connectedCount === 0 ? "No WebSocket connections" : null,
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
    if (this.backfillCheckInterval) clearInterval(this.backfillCheckInterval);

    await this.subscriptionManager.destroy();

    for (const [_, connection] of this.connections.entries()) {
      try {
        connection.ticker.disconnect();
      } catch (err) {
        console.error("[MarketDataWorker] Error disconnecting:", err);
      }
    }

    this.connections.clear();

    await supabase.from("trading_engine_status").upsert({
      engine_type: "market_data",
      status: "stopped",
      error_message: "Worker shutdown",
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });

    await this.logSystemHealth("worker_stopped", { source: "market_data_worker" }, "info", "Market Data Worker stopped");

    console.log("[MarketDataWorker] Shutdown complete");
  }
}

const worker = new MarketDataWorker();

let isShuttingDown = false;

function getShutdownFlag(): boolean {
  return isShuttingDown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanup(): Promise<void> {
  console.log("[MarketDataWorker] Running cleanup...");
  await worker.shutdown();
}

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    
    console.log(`[MarketDataWorker] Received ${signal}, initiating graceful shutdown...`);
    isShuttingDown = true;
    
    try {
      await cleanup();
      console.log("[MarketDataWorker] Shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("[MarketDataWorker] Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error("[MarketDataWorker] Uncaught exception:", err);
  });

  process.on("unhandledRejection", (err) => {
    console.error("[MarketDataWorker] Unhandled rejection:", err);
  });
}

async function checkAndTriggerAutoLogin(): Promise<void> {
  try {
    const { data: expiredConfigs } = await supabase
      .from("admin_zerodha_configs")
      .select("id, name, token_expires_at, connection_status")
      .eq("is_active", true)
      .eq("auto_login_enabled", true);

    if (!expiredConfigs || expiredConfigs.length === 0) return;

    const now = new Date();
    const needsLogin: string[] = [];

    for (const config of expiredConfigs) {
      const expiresAt = config.token_expires_at ? new Date(config.token_expires_at) : null;
      const isExpired = !expiresAt || expiresAt <= now;
      const isDisconnected = config.connection_status !== "connected";

      if (isExpired || isDisconnected) {
        needsLogin.push(config.name);
      }
    }

    if (needsLogin.length > 0) {
      console.log(`[MarketDataWorker] Event-based auto-login triggered for: ${needsLogin.join(", ")}`);
      
      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      try {
        const response = await fetch(`${appUrl}/api/cron/zerodha-auto-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ triggerType: "event_based_worker" }),
        });

        if (response.ok) {
          console.log("[MarketDataWorker] Event-based auto-login completed successfully");
          await supabase.from("system_health_logs").insert({
            metric_type: "event_auto_login",
            metric_value: { accounts: needsLogin, source: "market_data_worker" },
            severity: "info",
            message: `Event-based auto-login triggered for ${needsLogin.length} accounts`,
          });
        } else {
          console.error("[MarketDataWorker] Event-based auto-login failed:", await response.text());
        }
      } catch (fetchErr) {
        console.error("[MarketDataWorker] Failed to call auto-login endpoint:", fetchErr);
      }
    }
  } catch (err) {
    console.error("[MarketDataWorker] Error checking token expiry:", err);
  }
}

async function heartbeatLoop(): Promise<void> {
  console.log("[MarketDataWorker] Starting heartbeat loop...");
  console.log("[MarketDataWorker] Market Data Worker ONLINE and heartbeat active");
  
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3;
  let lastAutoLoginCheck = 0;
  const AUTO_LOGIN_CHECK_INTERVAL = 300000; // 5 minutes
  
    while (!getShutdownFlag()) {
        try {
          // If worker is not running, try to start it periodically
          if (!worker.isRunning) {
            console.log("[MarketDataWorker] Worker not running, attempting periodic restart...");
            await worker.start().catch(err => console.error("[MarketDataWorker] Restart failed:", err));
          }

          // Check for expired tokens and trigger auto-login if needed (every 5 minutes)
          const now = Date.now();
          if (now - lastAutoLoginCheck >= AUTO_LOGIN_CHECK_INTERVAL) {
            lastAutoLoginCheck = now;
            await checkAndTriggerAutoLogin();
          }

          // Use the worker's own update method which is more robust
          await (worker as any).updateEngineStatus();
        
        consecutiveFailures = 0;
        await sleep(30000);
    } catch (error) {
      consecutiveFailures++;
      console.error(`[MarketDataWorker] Heartbeat error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, error);
      
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error("[MarketDataWorker] CRITICAL: Heartbeat failed 3 consecutive times. Triggering SAFE_MODE...");
        
        try {
          await supabase.from("system_flags").upsert({
            flag_name: "SAFE_MODE",
            flag_value: true,
            updated_at: new Date().toISOString(),
            updated_by: "market_data_worker",
            reason: "Heartbeat failed 3 consecutive times - database connectivity issue",
          }, { onConflict: "flag_name" });
          
          await supabase.from("system_health_logs").insert({
            metric_type: "heartbeat_failure",
            metric_value: { consecutive_failures: consecutiveFailures, source: "market_data_worker" },
            severity: "critical",
            message: "Market Data Worker heartbeat failed 3 times - SAFE_MODE activated",
          });
        } catch (alertErr) {
          console.error("[MarketDataWorker] Failed to alert admin:", alertErr);
        }
        
        consecutiveFailures = 0;
      }
      
      await sleep(10000);
    }
  }
}

async function main(): Promise<void> {
  console.log("[MarketDataWorker] Starting Market Data Worker (24/7 Persistent Mode)...");
  
  setupGracefulShutdown();
  
  await worker.start();
  
  console.log("[MarketDataWorker] Worker initialized, entering persistent mode...");
  
  await Promise.all([
    heartbeatLoop(),
  ]);
}

main().catch((err) => {
  console.error("[MarketDataWorker] Fatal error:", err);
  process.exit(1);
});

export { worker, MarketDataWorker };
