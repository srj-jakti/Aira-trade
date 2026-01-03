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
 * - MAX 1 fallback WebSocket per API key (EPHEMERAL ONLY)
 * 
 * CRITICAL RULES:
 * - Instrument tokens are GLOBALLY UNIQUE (one token = one socket)
 * - Priority: CORE > POPULAR > TEMP (higher tier never overridden)
 * - Fallback WebSocket is EPHEMERAL - destroyed when load drops
 * - Resubscribe in priority order on reconnect
 */

import { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionTier = "CORE" | "POPULAR" | "TEMP";

const TIER_PRIORITY: Record<SubscriptionTier, number> = {
  CORE: 3,
  POPULAR: 2,
  TEMP: 1,
};

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
  createdAt: Date;
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
  alreadySubscribed?: boolean;
  existingTier?: SubscriptionTier;
}

const MAX_INSTRUMENTS_PER_WS = 3000;
const SOFT_LIMIT = 2500;
const FALLBACK_DESTROY_THRESHOLD = 500;
const POPULAR_CLEANUP_MS = 15 * 60 * 1000;
const TEMP_CLEANUP_MS = 5 * 60 * 1000;
const FALLBACK_MAX_AGE_MS = 30 * 60 * 1000;

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
  private fallbackCheckInterval: NodeJS.Timeout | null = null;
  private onFallbackDestroy?: (websocketId: string) => void;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  setFallbackDestroyCallback(callback: (websocketId: string) => void): void {
    this.onFallbackDestroy = callback;
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
        createdAt: new Date(),
      });
    }

    await this.loadExistingSubscriptions();
    this.startCleanupTimer();
    this.startFallbackMonitor();

    console.log(`[SubscriptionManager] Initialized. Tiers: CORE=${this.tierToApiKey.get("CORE")}, POPULAR=${this.tierToApiKey.get("POPULAR")}, TEMP=${this.tierToApiKey.get("TEMP")}`);
  }

  private async loadExistingSubscriptions(): Promise<void> {
    const { data, error } = await this.supabase
      .from("instrument_subscriptions")
      .select("*")
      .order("priority", { ascending: false });

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
    const addedSymbols = new Set<string>();

    const { data: nseStocks } = await this.supabase
      .from("instruments")
      .select("instrument_token, tradingsymbol")
      .in("tradingsymbol", NIFTY50_STOCKS)
      .eq("exchange", "NSE")
      .eq("segment", "NSE");

    if (nseStocks) {
      for (const stock of nseStocks) {
        coreTokens.push(stock.instrument_token);
        addedSymbols.add(stock.tradingsymbol);
      }
    }

    const { data: bseStocks } = await this.supabase
      .from("instruments")
      .select("instrument_token, tradingsymbol")
      .in("tradingsymbol", NIFTY50_STOCKS)
      .eq("exchange", "BSE")
      .eq("segment", "BSE");

    if (bseStocks) {
      for (const stock of bseStocks) {
        if (!addedSymbols.has(stock.tradingsymbol)) {
          coreTokens.push(stock.instrument_token);
          addedSymbols.add(stock.tradingsymbol);
        }
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

    const today = new Date();
    const maxExpiry = new Date(today);
    maxExpiry.setDate(maxExpiry.getDate() + 14);
    
    for (const underlying of INDEX_UNDERLYING_NAMES) {
      const { data: indexOptions } = await this.supabase
        .from("instruments")
        .select("instrument_token, expiry, strike")
        .or(`tradingsymbol.like.${underlying}%`)
        .in("instrument_type", ["CE", "PE"])
        .gte("expiry", today.toISOString().split("T")[0])
        .lte("expiry", maxExpiry.toISOString().split("T")[0])
        .limit(200);

      if (indexOptions) {
        for (const opt of indexOptions) {
          if (!coreTokens.includes(opt.instrument_token)) {
            coreTokens.push(opt.instrument_token);
          }
        }
      }
    }

    console.log(`[SubscriptionManager] Core instruments: ${coreTokens.length} (NSE preferred, including index options for next 2 weeks)`);
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
      const existingPriority = TIER_PRIORITY[existing.tier];
      const requestPriority = TIER_PRIORITY[tier];

      if (requestPriority <= existingPriority) {
        existing.lastUsedAt = new Date();
        await this.updateLastUsed(instrumentToken);
        return {
          success: true,
          instrumentToken,
          apiKeyId: existing.apiKeyId,
          websocketId: existing.websocketId,
          alreadySubscribed: true,
          existingTier: existing.tier,
        };
      }

      console.log(`[SubscriptionManager] Upgrading ${instrumentToken} from ${existing.tier} to ${tier}`);
      await this.unsubscribeInternal(instrumentToken, true);
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
        console.log(`[SubscriptionManager] Creating EPHEMERAL fallback WebSocket for ${apiKeyId}`);
        fallbackWs = {
          id: fallbackWsId,
          apiKeyId,
          isPrimary: false,
          subscribedTokens: new Set(),
          isConnected: false,
          createdAt: new Date(),
        };
        this.websockets.set(fallbackWsId, fallbackWs);
      }

      if (fallbackWs && fallbackWs.subscribedTokens.size < SOFT_LIMIT) {
        return fallbackWs;
      }
    }

    for (const [, ws] of this.websockets.entries()) {
      if (ws.isPrimary && ws.subscribedTokens.size < SOFT_LIMIT) {
        return ws;
      }
    }

    return primaryWs && primaryWs.subscribedTokens.size < MAX_INSTRUMENTS_PER_WS ? primaryWs : null;
  }

  async unsubscribe(instrumentToken: number): Promise<boolean> {
    return this.unsubscribeInternal(instrumentToken, false);
  }

  private async unsubscribeInternal(instrumentToken: number, allowCore: boolean): Promise<boolean> {
    const subscription = this.subscriptions.get(instrumentToken);
    if (!subscription) {
      return false;
    }

    if (!allowCore && subscription.tier === "CORE") {
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

    return true;
  }

  private startFallbackMonitor(): void {
    this.fallbackCheckInterval = setInterval(() => {
      this.checkFallbackWebSockets();
    }, 30000);
  }

  private checkFallbackWebSockets(): void {
    const now = Date.now();
    const toDestroy: string[] = [];

    for (const [wsId, ws] of this.websockets.entries()) {
      if (!ws.isPrimary) {
        const age = now - ws.createdAt.getTime();
        const shouldDestroy = 
          ws.subscribedTokens.size < FALLBACK_DESTROY_THRESHOLD ||
          age > FALLBACK_MAX_AGE_MS;

        if (shouldDestroy) {
          console.log(`[SubscriptionManager] Marking fallback ${wsId} for destruction (count: ${ws.subscribedTokens.size}, age: ${Math.floor(age / 60000)}min)`);
          toDestroy.push(wsId);
        }
      }
    }

    for (const wsId of toDestroy) {
      this.destroyFallbackWebSocket(wsId);
    }
  }

  private destroyFallbackWebSocket(websocketId: string): void {
    const ws = this.websockets.get(websocketId);
    if (!ws || ws.isPrimary) return;

    const apiKeyId = ws.apiKeyId;
    const primaryWsId = `${apiKeyId}_primary`;
    const primaryWs = this.websockets.get(primaryWsId);

    if (primaryWs) {
      const tokensToMove = Array.from(ws.subscribedTokens);
      for (const token of tokensToMove) {
        const sub = this.subscriptions.get(token);
        if (sub) {
          sub.websocketId = primaryWsId;
          primaryWs.subscribedTokens.add(token);
        }
      }
      console.log(`[SubscriptionManager] Moved ${tokensToMove.length} tokens from fallback to primary`);
    }

    if (this.onFallbackDestroy) {
      this.onFallbackDestroy(websocketId);
    }

    this.websockets.delete(websocketId);
    console.log(`[SubscriptionManager] DESTROYED ephemeral fallback WebSocket ${websocketId}`);
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

  getTokensForResubscription(websocketId: string): { core: number[]; popular: number[]; temp: number[] } {
    const ws = this.websockets.get(websocketId);
    if (!ws) return { core: [], popular: [], temp: [] };

    const core: number[] = [];
    const popular: number[] = [];
    const temp: number[] = [];

    for (const token of ws.subscribedTokens) {
      const sub = this.subscriptions.get(token);
      if (sub) {
        if (sub.tier === "CORE") core.push(token);
        else if (sub.tier === "POPULAR") popular.push(token);
        else temp.push(token);
      }
    }

    return { core, popular, temp };
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

  isInstrumentSubscribed(instrumentToken: number): boolean {
    return this.subscriptions.has(instrumentToken);
  }

  getInstrumentSubscription(instrumentToken: number): InstrumentSubscription | undefined {
    return this.subscriptions.get(instrumentToken);
  }

  getStats(): {
    totalSubscriptions: number;
    byTier: Record<SubscriptionTier, number>;
    byApiKey: Record<string, number>;
    websocketStats: Array<{ id: string; count: number; isPrimary: boolean; age: number }>;
    fallbackWebSockets: number;
  } {
    const byTier: Record<SubscriptionTier, number> = { CORE: 0, POPULAR: 0, TEMP: 0 };
    const byApiKey: Record<string, number> = {};

    for (const sub of this.subscriptions.values()) {
      byTier[sub.tier]++;
      byApiKey[sub.apiKeyId] = (byApiKey[sub.apiKeyId] || 0) + 1;
    }

    const now = Date.now();
    const websocketStats = Array.from(this.websockets.values()).map(ws => ({
      id: ws.id,
      count: ws.subscribedTokens.size,
      isPrimary: ws.isPrimary,
      age: Math.floor((now - ws.createdAt.getTime()) / 60000),
    }));

    const fallbackWebSockets = Array.from(this.websockets.values()).filter(ws => !ws.isPrimary).length;

    return {
      totalSubscriptions: this.subscriptions.size,
      byTier,
      byApiKey,
      websocketStats,
      fallbackWebSockets,
    };
  }

  async touchSubscription(instrumentToken: number): Promise<void> {
    const sub = this.subscriptions.get(instrumentToken);
    if (sub) {
      sub.lastUsedAt = new Date();
    }
  }

  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.fallbackCheckInterval) {
      clearInterval(this.fallbackCheckInterval);
    }
  }
}
