/**
 * LIVE-HISTORICAL BACKFILL SERVICE
 *
 * Responsible for ensuring live_candles table has sufficient recent history.
 * This service fetches data from Zerodha Historical API and stores in live_candles.
 *
 * IMPORTANT:
 * - ONLY writes to live_candles (never historical_candles)
 * - Uses Zerodha Historical API for recent data
 * - Respects retention policy per timeframe
 */
import { SupabaseClient } from "@supabase/supabase-js";
interface BackfillResult {
    instrumentToken: number;
    timeframe: string;
    candlesInserted: number;
    fromDate: string;
    toDate: string;
    success: boolean;
    error?: string;
}
export declare class BackfillService {
    private supabase;
    private apiKey;
    private accessToken;
    private isRunning;
    private backfillQueue;
    constructor(supabase: SupabaseClient, apiKey: string, accessToken: string);
    /**
     * Check coverage and backfill if needed for an instrument
     */
    checkAndBackfillInstrument(instrumentToken: number): Promise<BackfillResult[]>;
    /**
     * Check current coverage for an instrument/timeframe
     */
    private checkCoverage;
    /**
     * Backfill data for a specific instrument/timeframe
     */
    private backfillTimeframe;
    /**
     * Fetch historical candles from Zerodha API
     */
    private fetchFromZerodha;
    /**
     * Queue an instrument for backfill
     */
    queueBackfill(instrumentToken: number, timeframe: string): void;
    /**
     * Process the backfill queue (called periodically)
     */
    processQueue(): Promise<void>;
    /**
     * Backfill all CORE instruments on startup
     */
    backfillCoreInstruments(): Promise<void>;
    /**
     * Clean up old data beyond retention policy
     */
    cleanupOldData(): Promise<void>;
}
export {};
//# sourceMappingURL=backfill-service.d.ts.map