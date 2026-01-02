/**
 * SUBSCRIPTION MANAGER
 * Manages tiered instrument subscriptions across multiple API keys
 * 
 * Tiers:
 * - CORE: Always subscribed (indices, NIFTY50, ATM options)
 * - POPULAR: Scanner/watchlist instruments (15-min inactivity cleanup)
 * - TEMP: User search/chart instruments (5-min inactivity cleanup)
 * 
 * Limits:
 * - MAX 3000 instruments per WebSocket (Zerodha hard limit)
 * - SOFT LIMIT 2500 instruments per WebSocket (buffer)
 * - MAX 1 fallback WebSocket per API key
 */

import { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionTier = "CORE" | "POPULAR" | "TEMP";

export interface InstrumentSubscription {
  instrumentToken: number;
  tier: SubscriptionTier;
  apiKeyId: string;
  websocketId: string;
  lastUsedAt: Date;
}

export interface ApiKeyConfig {
  id: string;
  tierAssignment: SubscriptionTier;
  zerodhaConfigId: string;
  apiKey: string;
  accessToken: string;
  name: string;
}

export interface WebSocketState {
  id: string;
  apiKeyId: string;
  isPrimary: boolean;
  subscribedTokens: Set<number>;
  isConnected: boolean;
}

export interface SubscriptionRequest {
  instrumentToken: number;
  tier: SubscriptionTier;
  source: string;
}

export interface SubscriptionResult {
  success: boolean;
  instrumentToken: number;
  apiKeyId?: string;
  websocketId?: string;
  error?: string;
}

const MAX_INSTRUMENTS_PER_WS = 3000;
const SOFT_LIMIT = 2500;
const CORE_CLEANUP_INTERVAL = 0;
const POPULAR_CLEANUP_MS = 15 * 60 * 1000;
const TEMP_CLEANUP_MS = 5 * 60 * 1000;

const NIFTY50_TOKENS = [
  256265, // NIFTY 50
  260105, // NIFTY BANK
  257801, // FINNIFTY
  265, // SENSEX
];

const NIFTY50_STOCKS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
  "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK",
  "LT", "AXISBANK", "BAJFINANCE", "ASIANPAINT", "MARUTI",
  "HCLTECH", "SUNPHARMA", "TITAN", "NTPC", "ONGC",
  "POWERGRID", "ULTRACEMCO", "WIPRO", "NESTLEIND", "JSWSTEEL",
  "TATAMOTORS", "M&M", "ADANIENT", "COALINDIA", "BAJAJFINSV",
  "TATASTEEL", "TECHM", "HINDALCO", "ADANIPORTS", "INDUSINDBK",
  "GRASIM", "DRREDDY", "BRITANNIA", "CIPLA", "APOLLOHOSP",
  "EICHERMOT", "SBILIFE", "DIVISLAB", "BPCL", "HEROMOTOCO",
  "TATACONSUM", "BAJAJ-AUTO", "UPL", "LTIM", "HDFCLIFE"
];

export class SubscriptionManager {
  private supabase: SupabaseClient;
  private apiKeyConfigs: Map<string, ApiKeyConfig> = new Map();
  private websockets: Map<string, WebSocketState> = new Map();
  private subscriptions: Map<number, InstrumentSubscription> = new Map();
  private tierToApiKey: Map<SubscriptionTier, string> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(configs: ApiKeyConfig[]): Promise<void> {
    console.log(`[SubscriptionManager] Initializing with ${configs.length} API keys`);

    for (const config of configs) {
      this.apiKeyConfigs.set(config.id, config);
      this.tierToApiKey.set(config.tierAssignment, config.id);

      const primaryWsId = `${config.id}_primary`;
      this.websockets.set(primaryWsId, {
        id: primaryWsId,
        apiKeyId: config.id,
        isPrimary: true,
        subscribedTokens: new Set(),
        isConnected: false,
      });
    }

    await this.loadExistingSubscriptions();
    this.startCleanupTimer();

    console.log(`[SubscriptionManager] Initialized. Tiers mapped: CORE=${this.tierToApiKey.get("CORE")}, POPULAR=${this.tierToApiKey.get("POPULAR")}, TEMP=${this.tierToApiKey.get("TEMP")}`);
  }

  private async loadExistingSubscriptions(): Promise<void> {
    const { data, error } = await this.supabase
      .from("instrument_subscriptions")
      .select("*");

    if (error) {
      console.error("[SubscriptionManager] Failed to load subscriptions:", error.message);
      return;
    }

    if (data) {
      for (const row of data) {
        this.subscriptions.set(row.instrument_token, {
          instrumentToken: row.instrument_token,
          tier: row.priority as SubscriptionTier,
          apiKeyId: row.api_key_id,
          websocketId: row.websocket_id,
          lastUsedAt: new Date(row.last_used_at),
        });

        const ws = this.websockets.get(row.websocket_id);
        if (ws) {
          ws.subscribedTokens.add(row.instrument_token);
        }
      }
      console.log(`[SubscriptionManager] Loaded ${data.length} existing subscriptions`);
    }
  }

  async getCoreInstruments(): Promise<number[]> {
    const coreTokens: number[] = [...NIFTY50_TOKENS];

    const { data: stocks } = await this.supabase
      .from("instruments")
      .select("instrument_token")
      .in("tradingsymbol", NIFTY50_STOCKS)
      .eq("exchange", "NSE")
      .eq("segment", "NSE");

    if (stocks) {
      for (const stock of stocks) {
        coreTokens.push(stock.instrument_token);
      }
    }

    const { data: indices } = await this.supabase
      .from("instruments")
      .select("instrument_token")
      .eq("segment", "INDICES");

    if (indices) {
      for (const idx of indices) {
        if (!coreTokens.includes(idx.instrument_token)) {
          coreTokens.push(idx.instrument_token);
        }
      }
    }

    console.log(`[SubscriptionManager] Core instruments: ${coreTokens.length}`);
    return coreTokens;
  }

  async subscribeCore(): Promise<SubscriptionResult[]> {
    const coreTokens = await this.getCoreInstruments();
    const results: SubscriptionResult[] = [];

    for (const token of coreTokens) {
      const result = await this.subscribe({
        instrumentToken: token,
        tier: "CORE",
        source: "system_init",
      });
      results.push(result);
    }

    return results;
  }

  async subscribe(request: SubscriptionRequest): Promise<SubscriptionResult> {
    const { instrumentToken, tier, source } = request;

    const existing = this.subscriptions.get(instrumentToken);
    if (existing) {
      existing.lastUsedAt = new Date();
      await this.updateLastUsed(instrumentToken);
      return {
        success: true,
        instrumentToken,
        apiKeyId: existing.apiKeyId,
        websocketId: existing.websocketId,
      };
    }

    const apiKeyId = this.tierToApiKey.get(tier);
    if (!apiKeyId) {
      const fallbackApiKeyId = this.tierToApiKey.get("TEMP") || 
                               this.tierToApiKey.get("POPULAR") || 
                               this.tierToApiKey.get("CORE");
      if (!fallbackApiKeyId) {
        return {
          success: false,
          instrumentToken,
          error: `No API key configured for tier ${tier}`,
        };
      }
    }

    const targetApiKeyId = apiKeyId || Array.from(this.apiKeyConfigs.keys())[0];
    const websocket = this.findAvailableWebSocket(targetApiKeyId, tier);

    if (!websocket) {
      console.warn(`[SubscriptionManager] No available WebSocket for ${instrumentToken} (tier: ${tier})`);
      return {
        success: false,
        instrumentToken,
        error: "No available WebSocket capacity",
      };
    }

    if (websocket.subscribedTokens.size >= MAX_INSTRUMENTS_PER_WS) {
      return {
        success: false,
        instrumentToken,
        error: `WebSocket at max capacity (${MAX_INSTRUMENTS_PER_WS})`,
      };
    }

    const subscription: InstrumentSubscription = {
      instrumentToken,
      tier,
      apiKeyId: targetApiKeyId,
      websocketId: websocket.id,
      lastUsedAt: new Date(),
    };

    this.subscriptions.set(instrumentToken, subscription);
    websocket.subscribedTokens.add(instrumentToken);

    await this.persistSubscription(subscription);

    console.log(`[SubscriptionManager] Subscribed ${instrumentToken} (${tier}) to ${websocket.id}. Total: ${websocket.subscribedTokens.size}`);

    return {
      success: true,
      instrumentToken,
      apiKeyId: targetApiKeyId,
      websocketId: websocket.id,
    };
  }

  private findAvailableWebSocket(apiKeyId: string, tier: SubscriptionTier): WebSocketState | null {
    const primaryWsId = `${apiKeyId}_primary`;
    const primaryWs = this.websockets.get(primaryWsId);

    if (primaryWs && primaryWs.subscribedTokens.size < SOFT_LIMIT) {
      return primaryWs;
    }

    if (primaryWs && primaryWs.subscribedTokens.size < MAX_INSTRUMENTS_PER_WS) {
      if (tier === "CORE" || tier === "POPULAR") {
        return primaryWs;
      }
    }

    if (tier === "TEMP") {
      const fallbackWsId = `${apiKeyId}_fallback`;
      let fallbackWs = this.websockets.get(fallbackWsId);

      if (!fallbackWs && primaryWs && primaryWs.subscribedTokens.size >= SOFT_LIMIT) {
        console.log(`[SubscriptionManager] Creating fallback WebSocket for ${apiKeyId}`);
        fallbackWs = {
          id: fallbackWsId,
          apiKeyId,
          isPrimary: false,
          subscribedTokens: new Set(),
          isConnected: false,
        };
        this.websockets.set(fallbackWsId, fallbackWs);
      }

      if (fallbackWs && fallbackWs.subscribedTokens.size < SOFT_LIMIT) {
        return fallbackWs;
      }
    }

    for (const [wsId, ws] of this.websockets.entries()) {
      if (ws.isPrimary && ws.subscribedTokens.size < SOFT_LIMIT) {
        return ws;
      }
    }

    return primaryWs && primaryWs.subscribedTokens.size < MAX_INSTRUMENTS_PER_WS ? primaryWs : null;
  }

  async unsubscribe(instrumentToken: number): Promise<boolean> {
    const subscription = this.subscriptions.get(instrumentToken);
    if (!subscription) {
      return false;
    }

    if (subscription.tier === "CORE") {
      console.warn(`[SubscriptionManager] Cannot unsubscribe CORE instrument ${instrumentToken}`);
      return false;
    }

    const ws = this.websockets.get(subscription.websocketId);
    if (ws) {
      ws.subscribedTokens.delete(instrumentToken);
    }

    this.subscriptions.delete(instrumentToken);

    await this.supabase
      .from("instrument_subscriptions")
      .delete()
      .eq("instrument_token", instrumentToken);

    console.log(`[SubscriptionManager] Unsubscribed ${instrumentToken}`);

    if (ws && !ws.isPrimary && ws.subscribedTokens.size === 0) {
      console.log(`[SubscriptionManager] Removing empty fallback WebSocket ${ws.id}`);
      this.websockets.delete(ws.id);
    }

    return true;
  }

  private async persistSubscription(sub: InstrumentSubscription): Promise<void> {
    await this.supabase.from("instrument_subscriptions").upsert({
      instrument_token: sub.instrumentToken,
      priority: sub.tier,
      api_key_id: sub.apiKeyId,
      websocket_id: sub.websocketId,
      last_used_at: sub.lastUsedAt.toISOString(),
    }, { onConflict: "instrument_token" });
  }

  private async updateLastUsed(instrumentToken: number): Promise<void> {
    await this.supabase
      .from("instrument_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("instrument_token", instrumentToken);
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupInactiveSubscriptions();
    }, 60000);
  }

  async cleanupInactiveSubscriptions(): Promise<number> {
    const now = Date.now();
    const toRemove: number[] = [];

    for (const [token, sub] of this.subscriptions.entries()) {
      const inactiveMs = now - sub.lastUsedAt.getTime();

      if (sub.tier === "POPULAR" && inactiveMs > POPULAR_CLEANUP_MS) {
        toRemove.push(token);
      } else if (sub.tier === "TEMP" && inactiveMs > TEMP_CLEANUP_MS) {
        toRemove.push(token);
      }
    }

    for (const token of toRemove) {
      await this.unsubscribe(token);
    }

    if (toRemove.length > 0) {
      console.log(`[SubscriptionManager] Cleaned up ${toRemove.length} inactive subscriptions`);
    }

    return toRemove.length;
  }

  getSubscribedTokensForWebSocket(websocketId: string): number[] {
    const ws = this.websockets.get(websocketId);
    return ws ? Array.from(ws.subscribedTokens) : [];
  }

  getAllSubscribedTokens(): number[] {
    return Array.from(this.subscriptions.keys());
  }

  getSubscriptionsByApiKey(apiKeyId: string): InstrumentSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.apiKeyId === apiKeyId);
  }

  getWebSocketsForApiKey(apiKeyId: string): WebSocketState[] {
    return Array.from(this.websockets.values())
      .filter(ws => ws.apiKeyId === apiKeyId);
  }

  setWebSocketConnected(websocketId: string, connected: boolean): void {
    const ws = this.websockets.get(websocketId);
    if (ws) {
      ws.isConnected = connected;
    }
  }

  needsFallbackWebSocket(apiKeyId: string): boolean {
    const primaryWsId = `${apiKeyId}_primary`;
    const primaryWs = this.websockets.get(primaryWsId);
    const fallbackWsId = `${apiKeyId}_fallback`;
    const fallbackWs = this.websockets.get(fallbackWsId);

    return primaryWs !== undefined && 
           primaryWs.subscribedTokens.size >= SOFT_LIMIT && 
           !fallbackWs;
  }

  hasFallbackWebSocket(apiKeyId: string): boolean {
    return this.websockets.has(`${apiKeyId}_fallback`);
  }

  getStats(): {
    totalSubscriptions: number;
    byTier: Record<SubscriptionTier, number>;
    byApiKey: Record<string, number>;
    websocketStats: Array<{ id: string; count: number; isPrimary: boolean }>;
  } {
    const byTier: Record<SubscriptionTier, number> = { CORE: 0, POPULAR: 0, TEMP: 0 };
    const byApiKey: Record<string, number> = {};

    for (const sub of this.subscriptions.values()) {
      byTier[sub.tier]++;
      byApiKey[sub.apiKeyId] = (byApiKey[sub.apiKeyId] || 0) + 1;
    }

    const websocketStats = Array.from(this.websockets.values()).map(ws => ({
      id: ws.id,
      count: ws.subscribedTokens.size,
      isPrimary: ws.isPrimary,
    }));

    return {
      totalSubscriptions: this.subscriptions.size,
      byTier,
      byApiKey,
      websocketStats,
    };
  }

  async touchSubscription(instrumentToken: number): Promise<void> {
    const sub = this.subscriptions.get(instrumentToken);
    if (sub) {
      sub.lastUsedAt = new Date();
      await this.updateLastUsed(instrumentToken);
    }
  }

  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
