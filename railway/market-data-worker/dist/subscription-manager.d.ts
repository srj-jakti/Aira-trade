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
import { SupabaseClient } from "@supabase/supabase-js";
export type SubscriptionTier = "CORE" | "SCANNER" | "TEMP" | "POPULAR";
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
    sourceId?: string;
    userId?: string;
    neverCleanup?: boolean;
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
export declare class SubscriptionManager {
    private supabase;
    private apiKeyConfigs;
    private websockets;
    private subscriptions;
    private tierToApiKey;
    private cleanupInterval;
    private fallbackCheckInterval;
    private onFallbackDestroy?;
    constructor(supabase: SupabaseClient);
    setFallbackDestroyCallback(callback: (websocketId: string) => void): void;
    initialize(configs: ApiKeyConfig[]): Promise<void>;
    private loadExistingSubscriptions;
    getCoreInstruments(): Promise<number[]>;
    subscribeCore(): Promise<SubscriptionResult[]>;
    subscribe(request: SubscriptionRequest): Promise<SubscriptionResult>;
    private findAvailableWebSocket;
    unsubscribe(instrumentToken: number): Promise<boolean>;
    private unsubscribeInternal;
    private startFallbackMonitor;
    private checkFallbackWebSockets;
    private destroyFallbackWebSocket;
    private persistSubscription;
    private updateLastUsed;
    private startCleanupTimer;
    cleanupInactiveSubscriptions(): Promise<number>;
    getSubscribedTokensForWebSocket(websocketId: string): number[];
    getTokensForResubscription(websocketId: string): {
        core: number[];
        scanner: number[];
        temp: number[];
    };
    getAllSubscribedTokens(): number[];
    getSubscriptionsByApiKey(apiKeyId: string): InstrumentSubscription[];
    getWebSocketsForApiKey(apiKeyId: string): WebSocketState[];
    setWebSocketConnected(websocketId: string, connected: boolean): void;
    needsFallbackWebSocket(apiKeyId: string): boolean;
    hasFallbackWebSocket(apiKeyId: string): boolean;
    isInstrumentSubscribed(instrumentToken: number): boolean;
    getInstrumentSubscription(instrumentToken: number): InstrumentSubscription | undefined;
    getStats(): {
        totalSubscriptions: number;
        byTier: Record<SubscriptionTier, number>;
        byApiKey: Record<string, number>;
        websocketStats: Array<{
            id: string;
            count: number;
            isPrimary: boolean;
            age: number;
        }>;
        fallbackWebSockets: number;
    };
    touchSubscription(instrumentToken: number): Promise<void>;
    subscribeScannerInstruments(): Promise<SubscriptionResult[]>;
    destroy(): Promise<void>;
}
//# sourceMappingURL=subscription-manager.d.ts.map