import { Signal } from "./executor";
import { MarketContext } from "./market-context";
export interface CandleData {
    instrument_token: number;
    timeframe: string;
    bucket_start: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi: number;
    indicators?: any;
}
export interface Strategy {
    id: string;
    name: string;
    timeframe: string;
    instruments: number[];
    zairoth_intent?: string;
    buy_entry_logic?: any;
    sell_entry_logic?: any;
    executable_strategy?: any;
    buyExit?: any;
    sellExit?: any;
}
/**
 * Fetches the latest candles for given instruments and timeframe.
 * Prioritizes Redis for low latency, falls back to Supabase.
 */
export declare function getLatestCandles(instrumentTokens: number[], timeframe: string): Promise<CandleData[]>;
export declare function getStrategy(strategyId: string): Promise<Strategy | null>;
export type SignalRole = "INTENT" | "CONFIRMATION" | "INVALIDATION";
export type TradeState = "IDLE" | "SETUP_DETECTED" | "AWAITING_CONFIRMATION" | "CONFIRMED" | "INVALIDATED";
export interface SignalMemory {
    role: SignalRole;
    ruleName: string;
    triggeredAt: number;
    expiresAt: number;
    value: number;
    direction: "LONG" | "SHORT";
}
export interface TradeSetup {
    state: TradeState;
    direction: "LONG" | "SHORT" | null;
    intentSignal: SignalMemory | null;
    confirmations: SignalMemory[];
    setupCandleIndex: number;
    reason: string;
    context?: MarketContext;
}
export declare function evaluateWithAI(strategy: Strategy, candles: CandleData[], userConfig: {
    risk_per_trade: number;
    max_daily_loss: number;
    user_id: string;
    capital_used?: number;
}): Promise<Signal | null>;
export declare function evaluateWithRules(strategy: Strategy, candles: CandleData[], userId: string, context?: MarketContext): Promise<Signal | null>;
export declare function checkKillSwitches(userId: string, userConfig: {
    max_daily_loss: number;
    max_trades_per_day: number;
}): Promise<{
    triggered: boolean;
    reason?: string;
}>;
//# sourceMappingURL=evaluator.d.ts.map