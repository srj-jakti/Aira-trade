/**
 * MULTI-ADMIN TICKER POOL
 * Manages multiple KiteTicker connections for horizontal scaling
 * Distributes instruments across admin accounts
 */

import { KiteTicker } from "kiteconnect";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";
import { marketDataEngine, MarketTick } from "@/lib/server/market-data-engine";
import { tickAggregator } from "@/lib/server/tick-aggregator";
import { killSwitchManager } from "@/lib/server/kill-switches";

interface AdminConfig {
  id: string;
  name: string;
  apiKey: string;
  accessToken: string;
  priority: number;
  maxInstruments: number;
}

interface TickerConnection {
  configId: string;
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

const MAX_INSTRUMENTS_PER_CONNECTION = 3000;

class MultiAdminTickerPool {
  private static instance: MultiAdminTickerPool;
  private connections: Map<string, TickerConnection> = new Map();
  private instrumentAssignments: Map<number, string> = new Map(); // token -> configId
  private isRunning = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private subscriptionRefreshInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): MultiAdminTickerPool {
    if (!MultiAdminTickerPool.instance) {
      MultiAdminTickerPool.instance = new MultiAdminTickerPool();
    }
    return MultiAdminTickerPool.instance;
  }

  async initialize(): Promise<boolean> {
    // Check kill switch
    if (!(await killSwitchManager.isMarketDataEnabled())) {
      console.log("[MultiTicker] Market data disabled by kill switch");
      return false;
    }

    const configs = await this.getActiveConfigs();
    
    if (configs.length === 0) {
      console.error("[MultiTicker] No active admin configs found");
      await killSwitchManager.enableSafeMode("No active admin Zerodha configs");
      return false;
    }

    console.log(`[MultiTicker] Initializing ${configs.length} ticker connections`);

    for (const config of configs) {
      await this.createConnection(config);
    }

    const connectedCount = Array.from(this.connections.values())
      .filter(c => c.isConnected).length;

    if (connectedCount === 0) {
      console.error("[MultiTicker] All connections failed");
      await killSwitchManager.enableSafeMode("All admin Zerodha connections failed");
      return false;
    }

    this.isRunning = true;
    this.startHealthCheck();
    this.startSubscriptionRefresh();

    // Initial subscription distribution
    await this.distributeSubscriptions();

    console.log(`[MultiTicker] ${connectedCount}/${configs.length} connections active`);
    return true;
  }

  private async getActiveConfigs(): Promise<AdminConfig[]> {
    const { data: configs } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("id, name, api_key, access_token, priority, max_instruments")
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .not("access_token", "is", null)
      .order("priority", { ascending: true });

    if (!configs) return [];

    return configs.map(c => ({
      id: c.id,
      name: c.name,
      apiKey: decrypt(c.api_key),
      accessToken: decrypt(c.access_token),
      priority: c.priority || 1,
      maxInstruments: c.max_instruments || MAX_INSTRUMENTS_PER_CONNECTION,
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
          ticker,
          isConnected: false,
          subscribedTokens: new Set(),
          lastHeartbeat: Date.now(),
        };

        ticker.autoReconnect(true, 50, 5);

        ticker.on("connect", () => {
          console.log(`[MultiTicker][${config.name}] Connected`);
          connection.isConnected = true;
          connection.lastHeartbeat = Date.now();
          this.updateConfigStatus(config.id, "connected", "websocket_connected");
          resolve(true);
        });

        ticker.on("ticks", (ticks: KiteTickData[]) => {
          this.handleTicks(ticks, config.id);
          connection.lastHeartbeat = Date.now();
        });

        ticker.on("disconnect", (code: number) => {
          console.log(`[MultiTicker][${config.name}] Disconnected: ${code}`);
          connection.isConnected = false;
          this.updateConfigStatus(config.id, "disconnected", "websocket_disconnected");
          
          // Redistribute instruments from this connection
          this.handleConnectionLoss(config.id);
        });

        ticker.on("error", (error: Error) => {
          console.error(`[MultiTicker][${config.name}] Error:`, error.message);
          this.updateConfigStatus(config.id, "error", "websocket_error", error.message);
        });

        ticker.on("noreconnect", () => {
          console.error(`[MultiTicker][${config.name}] Max reconnect attempts reached`);
          connection.isConnected = false;
          this.handleConnectionLoss(config.id);
        });

        ticker.connect();
        this.connections.set(config.id, connection);

        // Timeout for initial connection
        setTimeout(() => {
          if (!connection.isConnected) {
            console.warn(`[MultiTicker][${config.name}] Connection timeout`);
            resolve(false);
          }
        }, 30000);

      } catch (error) {
        console.error(`[MultiTicker] Error creating connection for ${config.name}:`, error);
        resolve(false);
      }
    });
  }

  private handleTicks(ticks: KiteTickData[], configId: string): void {
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

      // Process through market data engine
      marketDataEngine.processTick(normalizedTick);

      // Direct aggregation
      tickAggregator.processTickDirect({
        instrument_token: tick.instrument_token,
        last_price: tick.last_price,
        volume: tick.volume,
        oi: tick.oi,
        timestamp: new Date(),
      });
    }
  }

  private async handleConnectionLoss(configId: string): Promise<void> {
    const lostConnection = this.connections.get(configId);
    if (!lostConnection) return;

    const tokensToRedistribute = Array.from(lostConnection.subscribedTokens);
    
    // Clear assignments for lost tokens
    tokensToRedistribute.forEach(t => this.instrumentAssignments.delete(t));

    // Find available connections
    const availableConnections = Array.from(this.connections.entries())
      .filter(([id, conn]) => id !== configId && conn.isConnected)
      .map(([id, conn]) => ({ id, connection: conn }));

    if (availableConnections.length === 0) {
      console.error("[MultiTicker] No available connections for redistribution");
      
      // Check if ALL connections are down
      const allDown = Array.from(this.connections.values())
        .every(c => !c.isConnected);
      
      if (allDown) {
        await killSwitchManager.enableSafeMode("All admin WebSocket connections lost");
      }
      return;
    }

    // Distribute tokens across available connections
    let connectionIndex = 0;
    for (const token of tokensToRedistribute) {
      const target = availableConnections[connectionIndex % availableConnections.length];
      await this.subscribeToken(token, target.id);
      connectionIndex++;
    }

    console.log(`[MultiTicker] Redistributed ${tokensToRedistribute.length} instruments`);
  }

  async distributeSubscriptions(): Promise<void> {
    const instruments = await marketDataEngine.getSubscribedInstruments();
    
    if (instruments.length === 0) {
      console.log("[MultiTicker] No instruments to subscribe");
      return;
    }

    const activeConnections = Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.isConnected)
      .sort((a, b) => a[1].subscribedTokens.size - b[1].subscribedTokens.size);

    if (activeConnections.length === 0) {
      console.error("[MultiTicker] No active connections for subscription");
      return;
    }

    // Calculate target per connection
    const totalCapacity = activeConnections.length * MAX_INSTRUMENTS_PER_CONNECTION;
    const targetPerConnection = Math.ceil(instruments.length / activeConnections.length);

    console.log(`[MultiTicker] Distributing ${instruments.length} instruments across ${activeConnections.length} connections`);

    let connectionIndex = 0;
    const subscriptionPromises: Promise<void>[] = [];

    for (const instrument of instruments) {
      // Skip if already assigned
      if (this.instrumentAssignments.has(instrument.instrumentToken)) {
        continue;
      }

      // Find connection with capacity
      let assigned = false;
      for (let i = 0; i < activeConnections.length; i++) {
        const idx = (connectionIndex + i) % activeConnections.length;
        const [configId, connection] = activeConnections[idx];
        
        if (connection.subscribedTokens.size < MAX_INSTRUMENTS_PER_CONNECTION) {
          subscriptionPromises.push(
            this.subscribeToken(instrument.instrumentToken, configId, instrument.mode)
          );
          assigned = true;
          connectionIndex = (idx + 1) % activeConnections.length;
          break;
        }
      }

      if (!assigned) {
        console.warn(`[MultiTicker] Could not assign instrument ${instrument.instrumentToken} - all connections at capacity`);
      }
    }

    await Promise.all(subscriptionPromises);

    // Update engine status
    marketDataEngine.setRunning(true);
    await this.updateEngineStatus();
  }

  private async subscribeToken(
    token: number, 
    configId: string, 
    mode: "ltp" | "quote" | "full" = "quote"
  ): Promise<void> {
    const connection = this.connections.get(configId);
    if (!connection || !connection.isConnected) return;

    connection.ticker.subscribe([token]);
    
    const tickerMode = mode === "ltp" 
      ? connection.ticker.modeLTP 
      : mode === "full" 
        ? connection.ticker.modeFull 
        : connection.ticker.modeQuote;
    
    connection.ticker.setMode(tickerMode, [token]);
    connection.subscribedTokens.add(token);
    this.instrumentAssignments.set(token, configId);
  }

  private async updateConfigStatus(
    configId: string, 
    status: string, 
    websocketStatus: string,
    error?: string
  ): Promise<void> {
    await supabaseAdmin
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

    const connectedConfigs = Array.from(this.connections.values())
      .filter(c => c.isConnected)
      .map(c => c.configId);

    await supabaseAdmin.from("data_engine_status").upsert({
      engine_type: "market_data",
      status: this.isRunning ? "running" : "stopped",
      websocket_status: connectedConfigs.length > 0 ? "connected" : "disconnected",
      subscribed_instruments: totalSubscribed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      // Check kill switch
      if (!(await killSwitchManager.isMarketDataEnabled())) {
        console.log("[MultiTicker] Market data disabled, stopping health check");
        this.stop();
        return;
      }

      const now = Date.now();
      const staleThreshold = 60000; // 60 seconds

      for (const [configId, connection] of this.connections.entries()) {
        if (connection.isConnected && (now - connection.lastHeartbeat) > staleThreshold) {
          console.warn(`[MultiTicker] Connection ${configId} appears stale`);
          // Force reconnect by disconnecting
          connection.ticker.disconnect();
        }
      }

      await this.updateEngineStatus();
    }, 30000);
  }

  private startSubscriptionRefresh(): void {
    this.subscriptionRefreshInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.distributeSubscriptions();
      }
    }, 300000); // Every 5 minutes
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.subscriptionRefreshInterval) {
      clearInterval(this.subscriptionRefreshInterval);
      this.subscriptionRefreshInterval = null;
    }

    for (const [_, connection] of this.connections.entries()) {
      connection.ticker.disconnect();
    }

    this.connections.clear();
    this.instrumentAssignments.clear();
    marketDataEngine.setRunning(false);

    console.log("[MultiTicker] Stopped all connections");
  }

  getStatus(): {
    isRunning: boolean;
    connections: Array<{
      configId: string;
      isConnected: boolean;
      subscribedCount: number;
      lastHeartbeat: number;
    }>;
    totalSubscribed: number;
  } {
    const connections = Array.from(this.connections.entries()).map(([configId, conn]) => ({
      configId,
      isConnected: conn.isConnected,
      subscribedCount: conn.subscribedTokens.size,
      lastHeartbeat: conn.lastHeartbeat,
    }));

    return {
      isRunning: this.isRunning,
      connections,
      totalSubscribed: Array.from(this.connections.values())
        .reduce((sum, c) => sum + c.subscribedTokens.size, 0),
    };
  }

  // Get the best available ticker for ad-hoc subscriptions
  getAvailableTicker(): TickerConnection | null {
    const available = Array.from(this.connections.values())
      .filter(c => c.isConnected && c.subscribedTokens.size < MAX_INSTRUMENTS_PER_CONNECTION)
      .sort((a, b) => a.subscribedTokens.size - b.subscribedTokens.size);

    return available[0] || null;
  }
}

export const multiAdminTickerPool = MultiAdminTickerPool.getInstance();
