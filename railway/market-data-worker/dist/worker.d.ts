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
import { SubscriptionRequest } from "./subscription-manager";
declare class MarketDataWorker {
    private subscriptionManager;
    private connections;
    private apiKeyConfigs;
    private tickBuffer;
    private candleBuffers;
    private isRunning;
    private isShuttingDown;
    private tickCount;
    private ticksPerSecond;
    private lastTickAt;
    private lastTickCountReset;
    private tickFlushInterval;
    private candleFlushInterval;
    private healthCheckInterval;
    private subscriptionRefreshInterval;
    private backfillCheckInterval;
    private pendingSubscriptionRequests;
    private backfillService;
    private priceHistory;
    private indicatorStates;
    constructor();
    private destroyFallbackConnection;
    start(): Promise<void>;
    private getApiKeyConfigs;
    private getLegacyAdminConfigs;
    private createPrimaryConnection;
    private createFallbackConnection;
    private createConnection;
    private resubscribeTokens;
    private subscribeToCore;
    private subscribeToScanner;
    subscribeInstrument(request: SubscriptionRequest): Promise<boolean>;
    unsubscribeInstrument(instrumentToken: number): Promise<boolean>;
    private startSubscriptionRequestHandler;
    private handleTicks;
    private updateCandleBuffers;
    private startTickFlush;
    private startCandleFlush;
    private startHealthCheck;
    private startSubscriptionRefresh;
    /**
     * Periodically check for instruments needing Live-Historical backfill
     */
    private startBackfillChecker;
    private isMarketDataEnabled;
    private enterSafeMode;
    private updateEngineStatus;
    private logSystemHealth;
    shutdown(): Promise<void>;
}
declare const worker: MarketDataWorker;
export { worker, MarketDataWorker };
//# sourceMappingURL=worker.d.ts.map