"use strict";
/**
 * SUBSCRIPTION MANAGER
 * Manages tiered instrument subscriptions across multiple API keys
 *
 * Tiers:
 * - CORE: Always subscribed (indices, NIFTY50, ATM options) - NEVER cleaned
 * - SCANNER: Fixed instruments for Scanner + AI Auto-Trading - NEVER cleaned while active strategies exist
 * - TEMP: User on-demand instruments (Strategy/Analysis pages) - 5-min inactivity cleanup
 *
 * API Key Assignment:
 * - API Key A (CORE): Indices, NIFTY50, index options
 * - API Key B (SCANNER): Strategy instruments, scanner instruments
 * - API Key C (TEMP): User on-demand requests
 *
 * Limits:
 * - MAX 3000 instruments per WebSocket (Zerodha hard limit)
 * - SOFT LIMIT 2500 instruments per WebSocket (buffer)
 * - MAX 1 fallback WebSocket per API key (EPHEMERAL ONLY)
 *
 * CRITICAL RULES:
 * - Instrument tokens are GLOBALLY UNIQUE (one token = one socket)
 * - Priority: CORE > SCANNER > TEMP (higher tier never overridden)
 * - CORE and SCANNER tiers: NEVER auto-cleanup
 * - TEMP tier: 5-min inactivity cleanup
 * - Fallback WebSocket is EPHEMERAL - destroyed when load drops
 * - Resubscribe in priority order on reconnect
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionManager = void 0;
const TIER_PRIORITY = {
    CORE: 3,
    SCANNER: 2,
    POPULAR: 2, // Legacy - maps to SCANNER
    TEMP: 1,
};
const MAX_INSTRUMENTS_PER_WS = 3000;
const SOFT_LIMIT = 2500;
const FALLBACK_DESTROY_THRESHOLD = 500;
const TEMP_CLEANUP_MS = 5 * 60 * 1000; // 5 minutes for TEMP tier only
const FALLBACK_MAX_AGE_MS = 30 * 60 * 1000;
const NIFTY50_TOKENS = [
    256265, // NIFTY 50
    260105, // NIFTY BANK
    257801, // FINNIFTY
    265, // SENSEX
];
const INDEX_UNDERLYING_NAMES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX"];
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
class SubscriptionManager {
    supabase;
    apiKeyConfigs = new Map();
    websockets = new Map();
    subscriptions = new Map();
    tierToApiKey = new Map();
    cleanupInterval = null;
    fallbackCheckInterval = null;
    onFallbackDestroy;
    constructor(supabase) {
        this.supabase = supabase;
    }
    setFallbackDestroyCallback(callback) {
        this.onFallbackDestroy = callback;
    }
    async initialize(configs) {
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
        console.log(`[SubscriptionManager] Initialized. Tiers: CORE=${this.tierToApiKey.get("CORE")}, SCANNER=${this.tierToApiKey.get("SCANNER") || this.tierToApiKey.get("POPULAR")}, TEMP=${this.tierToApiKey.get("TEMP")}`);
    }
    async loadExistingSubscriptions() {
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
                    tier: row.priority,
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
    async getCoreInstruments() {
        const coreTokens = [...NIFTY50_TOKENS];
        const addedSymbols = new Set();
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
    async subscribeCore() {
        const coreTokens = await this.getCoreInstruments();
        const results = [];
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
    async subscribe(request) {
        const { instrumentToken, tier, source, sourceId, userId, neverCleanup } = request;
        // Map POPULAR to SCANNER for backward compatibility
        const effectiveTier = tier === "POPULAR" ? "SCANNER" : tier;
        const existing = this.subscriptions.get(instrumentToken);
        if (existing) {
            const existingPriority = TIER_PRIORITY[existing.tier];
            const requestPriority = TIER_PRIORITY[effectiveTier];
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
            console.log(`[SubscriptionManager] Upgrading ${instrumentToken} from ${existing.tier} to ${effectiveTier}`);
            await this.unsubscribeInternal(instrumentToken, true);
        }
        // Find API key for this tier (SCANNER falls back to POPULAR for legacy configs)
        let apiKeyId = this.tierToApiKey.get(effectiveTier);
        if (!apiKeyId && effectiveTier === "SCANNER") {
            apiKeyId = this.tierToApiKey.get("POPULAR");
        }
        if (!apiKeyId) {
            const fallbackApiKeyId = this.tierToApiKey.get("TEMP") ||
                this.tierToApiKey.get("SCANNER") ||
                this.tierToApiKey.get("POPULAR") ||
                this.tierToApiKey.get("CORE");
            if (!fallbackApiKeyId) {
                return {
                    success: false,
                    instrumentToken,
                    error: `No API key configured for tier ${effectiveTier}`,
                };
            }
            apiKeyId = fallbackApiKeyId;
        }
        const targetApiKeyId = apiKeyId || Array.from(this.apiKeyConfigs.keys())[0];
        const websocket = this.findAvailableWebSocket(targetApiKeyId, effectiveTier);
        if (!websocket) {
            console.warn(`[SubscriptionManager] No available WebSocket for ${instrumentToken} (tier: ${effectiveTier})`);
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
        const subscription = {
            instrumentToken,
            tier: effectiveTier,
            apiKeyId: targetApiKeyId,
            websocketId: websocket.id,
            lastUsedAt: new Date(),
        };
        this.subscriptions.set(instrumentToken, subscription);
        websocket.subscribedTokens.add(instrumentToken);
        await this.persistSubscription(subscription, source, sourceId, neverCleanup || effectiveTier === "CORE" || effectiveTier === "SCANNER");
        console.log(`[SubscriptionManager] Subscribed ${instrumentToken} (${effectiveTier}) to ${websocket.id}. Total: ${websocket.subscribedTokens.size}`);
        return {
            success: true,
            instrumentToken,
            apiKeyId: targetApiKeyId,
            websocketId: websocket.id,
        };
    }
    findAvailableWebSocket(apiKeyId, tier) {
        const primaryWsId = `${apiKeyId}_primary`;
        const primaryWs = this.websockets.get(primaryWsId);
        if (primaryWs && primaryWs.subscribedTokens.size < SOFT_LIMIT) {
            return primaryWs;
        }
        if (primaryWs && primaryWs.subscribedTokens.size < MAX_INSTRUMENTS_PER_WS) {
            if (tier === "CORE" || tier === "SCANNER" || tier === "POPULAR") {
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
    async unsubscribe(instrumentToken) {
        return this.unsubscribeInternal(instrumentToken, false);
    }
    async unsubscribeInternal(instrumentToken, allowCore) {
        const subscription = this.subscriptions.get(instrumentToken);
        if (!subscription) {
            return false;
        }
        // Protect CORE and SCANNER tiers from cleanup (unless explicitly allowed for upgrades)
        if (!allowCore && (subscription.tier === "CORE" || subscription.tier === "SCANNER")) {
            console.warn(`[SubscriptionManager] Cannot unsubscribe ${subscription.tier} instrument ${instrumentToken}`);
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
    startFallbackMonitor() {
        this.fallbackCheckInterval = setInterval(() => {
            this.checkFallbackWebSockets();
        }, 30000);
    }
    checkFallbackWebSockets() {
        const now = Date.now();
        const toDestroy = [];
        for (const [wsId, ws] of this.websockets.entries()) {
            if (!ws.isPrimary) {
                const age = now - ws.createdAt.getTime();
                const shouldDestroy = ws.subscribedTokens.size < FALLBACK_DESTROY_THRESHOLD ||
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
    destroyFallbackWebSocket(websocketId) {
        const ws = this.websockets.get(websocketId);
        if (!ws || ws.isPrimary)
            return;
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
    async persistSubscription(sub, sourceType, sourceId, neverCleanup) {
        await this.supabase.from("instrument_subscriptions").upsert({
            instrument_token: sub.instrumentToken,
            priority: sub.tier,
            api_key_id: sub.apiKeyId,
            websocket_id: sub.websocketId,
            last_used_at: sub.lastUsedAt.toISOString(),
            source_type: sourceType || "SYSTEM",
            source_id: sourceId || null,
            never_cleanup: neverCleanup || false,
        }, { onConflict: "instrument_token" });
    }
    async updateLastUsed(instrumentToken) {
        await this.supabase
            .from("instrument_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("instrument_token", instrumentToken);
    }
    startCleanupTimer() {
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupInactiveSubscriptions();
        }, 60000);
    }
    async cleanupInactiveSubscriptions() {
        const now = Date.now();
        const toRemove = [];
        for (const [token, sub] of this.subscriptions.entries()) {
            const inactiveMs = now - sub.lastUsedAt.getTime();
            // ONLY cleanup TEMP tier - CORE and SCANNER are NEVER cleaned up automatically
            if (sub.tier === "TEMP" && inactiveMs > TEMP_CLEANUP_MS) {
                toRemove.push(token);
            }
        }
        for (const token of toRemove) {
            await this.unsubscribe(token);
        }
        if (toRemove.length > 0) {
            console.log(`[SubscriptionManager] Cleaned up ${toRemove.length} inactive TEMP subscriptions`);
        }
        return toRemove.length;
    }
    getSubscribedTokensForWebSocket(websocketId) {
        const ws = this.websockets.get(websocketId);
        return ws ? Array.from(ws.subscribedTokens) : [];
    }
    getTokensForResubscription(websocketId) {
        const ws = this.websockets.get(websocketId);
        if (!ws)
            return { core: [], scanner: [], temp: [] };
        const core = [];
        const scanner = [];
        const temp = [];
        for (const token of ws.subscribedTokens) {
            const sub = this.subscriptions.get(token);
            if (sub) {
                if (sub.tier === "CORE")
                    core.push(token);
                else if (sub.tier === "SCANNER" || sub.tier === "POPULAR")
                    scanner.push(token);
                else
                    temp.push(token);
            }
        }
        return { core, scanner, temp };
    }
    getAllSubscribedTokens() {
        return Array.from(this.subscriptions.keys());
    }
    getSubscriptionsByApiKey(apiKeyId) {
        return Array.from(this.subscriptions.values())
            .filter(s => s.apiKeyId === apiKeyId);
    }
    getWebSocketsForApiKey(apiKeyId) {
        return Array.from(this.websockets.values())
            .filter(ws => ws.apiKeyId === apiKeyId);
    }
    setWebSocketConnected(websocketId, connected) {
        const ws = this.websockets.get(websocketId);
        if (ws) {
            ws.isConnected = connected;
        }
    }
    needsFallbackWebSocket(apiKeyId) {
        const primaryWsId = `${apiKeyId}_primary`;
        const primaryWs = this.websockets.get(primaryWsId);
        const fallbackWsId = `${apiKeyId}_fallback`;
        const fallbackWs = this.websockets.get(fallbackWsId);
        return primaryWs !== undefined &&
            primaryWs.subscribedTokens.size >= SOFT_LIMIT &&
            !fallbackWs;
    }
    hasFallbackWebSocket(apiKeyId) {
        return this.websockets.has(`${apiKeyId}_fallback`);
    }
    isInstrumentSubscribed(instrumentToken) {
        return this.subscriptions.has(instrumentToken);
    }
    getInstrumentSubscription(instrumentToken) {
        return this.subscriptions.get(instrumentToken);
    }
    getStats() {
        const byTier = { CORE: 0, SCANNER: 0, POPULAR: 0, TEMP: 0 };
        const byApiKey = {};
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
    async touchSubscription(instrumentToken) {
        const sub = this.subscriptions.get(instrumentToken);
        if (sub) {
            sub.lastUsedAt = new Date();
        }
    }
    async subscribeScannerInstruments() {
        const results = [];
        // Get instruments from scanner_instruments table
        const { data: scannerInstruments, error: scannerError } = await this.supabase
            .from("scanner_instruments")
            .select("instrument_token, tradingsymbol")
            .eq("is_active", true);
        if (scannerError) {
            console.error("[SubscriptionManager] Failed to load scanner instruments:", scannerError.message);
        }
        else if (scannerInstruments) {
            for (const inst of scannerInstruments) {
                const result = await this.subscribe({
                    instrumentToken: inst.instrument_token,
                    tier: "SCANNER",
                    source: "scanner_instruments",
                    neverCleanup: true,
                });
                results.push(result);
            }
            console.log(`[SubscriptionManager] Subscribed ${scannerInstruments.length} scanner instruments`);
        }
        // Get instruments from active strategies
        const { data: strategyInstruments, error: strategyError } = await this.supabase
            .from("active_trade_instruments")
            .select("instrument_token, tradingsymbol, source_type, source_id")
            .eq("is_active", true);
        if (strategyError) {
            console.error("[SubscriptionManager] Failed to load strategy instruments:", strategyError.message);
        }
        else if (strategyInstruments) {
            for (const inst of strategyInstruments) {
                const result = await this.subscribe({
                    instrumentToken: inst.instrument_token,
                    tier: "SCANNER",
                    source: inst.source_type,
                    sourceId: inst.source_id,
                    neverCleanup: true,
                });
                results.push(result);
            }
            console.log(`[SubscriptionManager] Subscribed ${strategyInstruments.length} strategy instruments`);
        }
        return results;
    }
    async destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.fallbackCheckInterval) {
            clearInterval(this.fallbackCheckInterval);
        }
    }
}
exports.SubscriptionManager = SubscriptionManager;
//# sourceMappingURL=subscription-manager.js.map