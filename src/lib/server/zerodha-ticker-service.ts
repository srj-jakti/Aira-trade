import { KiteTicker } from "kiteconnect";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";
import { marketDataEngine, MarketTick } from "@/lib/server/market-data-engine";

interface TickerConfig {
  apiKey: string;
  accessToken: string;
  configId: string;
}

interface KiteTickData {
  instrument_token: number;
  last_price: number;
  last_quantity?: number;
  average_price?: number;
  volume?: number;
  buy_quantity?: number;
  sell_quantity?: number;
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  change?: number;
  last_trade_time?: Date;
  oi?: number;
  oi_day_high?: number;
  oi_day_low?: number;
  timestamp?: Date;
}

type TickerMode = "ltp" | "quote" | "full";

class ZerodhaTickerService {
  private static instance: ZerodhaTickerService;
  private ticker: KiteTicker | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private currentConfigId: string | null = null;
  private subscribedTokens: Set<number> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 50;
  private reconnectInterval: number = 5000;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private subscriptionRefreshInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ZerodhaTickerService {
    if (!ZerodhaTickerService.instance) {
      ZerodhaTickerService.instance = new ZerodhaTickerService();
    }
    return ZerodhaTickerService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isConnecting) {
      console.log("[Ticker] Already connecting...");
      return false;
    }

    if (this.isConnected && this.ticker) {
      console.log("[Ticker] Already connected");
      return true;
    }

    this.isConnecting = true;

    try {
      const config = await this.getAdminConfig();
      if (!config) {
        console.error("[Ticker] No valid admin config found");
        this.isConnecting = false;
        return false;
      }

      await this.connect(config);
      return true;
    } catch (error) {
      console.error("[Ticker] Initialization error:", error);
      this.isConnecting = false;
      return false;
    }
  }

  private async getAdminConfig(): Promise<TickerConfig | null> {
    const { data: configs } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("id, api_key, access_token, connection_status")
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .order("priority", { ascending: true })
      .limit(1);

    if (!configs || configs.length === 0 || !configs[0].access_token) {
      return null;
    }

    const config = configs[0];
    return {
      apiKey: decrypt(config.api_key),
      accessToken: decrypt(config.access_token),
      configId: config.id,
    };
  }

  private async connect(config: TickerConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ticker = new KiteTicker({
          api_key: config.apiKey,
          access_token: config.accessToken,
        });

        this.currentConfigId = config.configId;

        this.ticker.autoReconnect(true, this.maxReconnectAttempts, this.reconnectInterval / 1000);

        this.ticker.on("connect", async () => {
          console.log("[Ticker] WebSocket connected");
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          await this.updateStatus("connected", "websocket_connected");
          
          await this.subscribeToInstruments();
          
          this.startHealthCheck();
          this.startSubscriptionRefresh();

          resolve();
        });

        this.ticker.on("ticks", (ticks: KiteTickData[]) => {
          this.handleTicks(ticks);
        });

        this.ticker.on("disconnect", async (code: number) => {
          console.log(`[Ticker] Disconnected with code: ${code}`);
          this.isConnected = false;
          await this.updateStatus("disconnected", "websocket_disconnected");
        });

        this.ticker.on("error", async (error: Error) => {
          console.error("[Ticker] Error:", error);
          await this.updateStatus("error", "websocket_error", error.message);
        });

        this.ticker.on("reconnect", (attempt: number, delay: number) => {
          console.log(`[Ticker] Reconnecting... attempt ${attempt}, delay ${delay}ms`);
          this.reconnectAttempts = attempt;
        });

        this.ticker.on("noreconnect", async () => {
          console.error("[Ticker] Max reconnection attempts reached");
          await this.updateStatus("failed", "max_reconnect_reached");
          this.stopHealthCheck();
          
          setTimeout(() => this.initialize(), 60000);
        });

        this.ticker.on("order_update", (order: unknown) => {
          console.log("[Ticker] Order update received (admin - ignoring):", order);
        });

        this.ticker.connect();

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleTicks(ticks: KiteTickData[]): void {
    for (const tick of ticks) {
      const normalizedTick: MarketTick = {
        instrumentToken: tick.instrument_token,
        lastPrice: tick.last_price,
        lastQuantity: tick.last_quantity,
        averagePrice: tick.average_price,
        volume: tick.volume,
        buyQuantity: tick.buy_quantity,
        sellQuantity: tick.sell_quantity,
        open: tick.ohlc?.open,
        high: tick.ohlc?.high,
        low: tick.ohlc?.low,
        close: tick.ohlc?.close,
        change: tick.change,
        changePercent: tick.ohlc?.close 
          ? ((tick.last_price - tick.ohlc.close) / tick.ohlc.close) * 100 
          : undefined,
        lastTradeTime: tick.last_trade_time ? new Date(tick.last_trade_time) : undefined,
        oi: tick.oi,
        oiDayHigh: tick.oi_day_high,
        oiDayLow: tick.oi_day_low,
        timestamp: new Date(),
      };

      marketDataEngine.processTick(normalizedTick);
    }
  }

  private async subscribeToInstruments(): Promise<void> {
    if (!this.ticker || !this.isConnected) {
      console.warn("[Ticker] Cannot subscribe - not connected");
      return;
    }

    const instruments = await marketDataEngine.getSubscribedInstruments();
    
    if (instruments.length === 0) {
      console.log("[Ticker] No instruments to subscribe");
      return;
    }

    const tokens = instruments.map(i => i.instrumentToken);
    
    const ltpTokens = instruments.filter(i => i.mode === "ltp").map(i => i.instrumentToken);
    const quoteTokens = instruments.filter(i => i.mode === "quote").map(i => i.instrumentToken);
    const fullTokens = instruments.filter(i => i.mode === "full").map(i => i.instrumentToken);

    this.ticker.subscribe(tokens);
    console.log(`[Ticker] Subscribed to ${tokens.length} instruments`);

    if (ltpTokens.length > 0) {
      this.ticker.setMode(this.ticker.modeLTP, ltpTokens);
    }
    if (quoteTokens.length > 0) {
      this.ticker.setMode(this.ticker.modeQuote, quoteTokens);
    }
    if (fullTokens.length > 0) {
      this.ticker.setMode(this.ticker.modeFull, fullTokens);
    }

    this.subscribedTokens = new Set(tokens);
    marketDataEngine.setSubscribedInstruments(instruments);
    marketDataEngine.setRunning(true, this.currentConfigId || undefined);

    await this.updateStatus("running", "websocket_connected", undefined, tokens.length);
  }

  async subscribe(tokens: number[], mode: TickerMode = "quote"): Promise<boolean> {
    if (!this.ticker || !this.isConnected) {
      console.warn("[Ticker] Cannot subscribe - not connected");
      return false;
    }

    const newTokens = tokens.filter(t => !this.subscribedTokens.has(t));
    
    if (newTokens.length === 0) {
      return true;
    }

    this.ticker.subscribe(newTokens);
    
    const tickerMode = mode === "ltp" 
      ? this.ticker.modeLTP 
      : mode === "full" 
        ? this.ticker.modeFull 
        : this.ticker.modeQuote;
    
    this.ticker.setMode(tickerMode, newTokens);

    newTokens.forEach(t => this.subscribedTokens.add(t));
    
    console.log(`[Ticker] Added ${newTokens.length} new subscriptions`);
    return true;
  }

  async unsubscribe(tokens: number[]): Promise<boolean> {
    if (!this.ticker || !this.isConnected) {
      return false;
    }

    const existingTokens = tokens.filter(t => this.subscribedTokens.has(t));
    
    if (existingTokens.length === 0) {
      return true;
    }

    this.ticker.unsubscribe(existingTokens);
    existingTokens.forEach(t => this.subscribedTokens.delete(t));
    
    console.log(`[Ticker] Unsubscribed ${existingTokens.length} instruments`);
    return true;
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    this.healthCheckInterval = setInterval(async () => {
      if (this.isConnected) {
        await this.updateStatus("running", "websocket_connected", undefined, this.subscribedTokens.size);
      }
    }, 30000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private startSubscriptionRefresh(): void {
    if (this.subscriptionRefreshInterval) {
      clearInterval(this.subscriptionRefreshInterval);
    }

    this.subscriptionRefreshInterval = setInterval(async () => {
      if (this.isConnected && this.ticker) {
        await this.subscribeToInstruments();
      }
    }, 300000);
  }

  private async updateStatus(
    status: string, 
    websocketStatus: string, 
    error?: string,
    subscribedCount?: number
  ): Promise<void> {
    try {
      await supabaseAdmin.from("data_engine_status").upsert({
        engine_type: "market_data",
        status,
        zerodha_config_id: this.currentConfigId,
        websocket_status: websocketStatus,
        subscribed_instruments: subscribedCount ?? this.subscribedTokens.size,
        last_error: error || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "engine_type" });
    } catch (err) {
      console.error("[Ticker] Failed to update status:", err);
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    
    if (this.subscriptionRefreshInterval) {
      clearInterval(this.subscriptionRefreshInterval);
      this.subscriptionRefreshInterval = null;
    }

    if (this.ticker) {
      this.ticker.disconnect();
      this.ticker = null;
    }

    this.isConnected = false;
    this.subscribedTokens.clear();
    this.currentConfigId = null;

    marketDataEngine.setRunning(false);
    await this.updateStatus("stopped", "disconnected");
    
    console.log("[Ticker] Disconnected and cleaned up");
  }

  getStatus(): {
    isConnected: boolean;
    subscribedCount: number;
    configId: string | null;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      subscribedCount: this.subscribedTokens.size,
      configId: this.currentConfigId,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  isReady(): boolean {
    return this.isConnected && this.ticker !== null;
  }
}

export const zerodhaTickerService = ZerodhaTickerService.getInstance();
