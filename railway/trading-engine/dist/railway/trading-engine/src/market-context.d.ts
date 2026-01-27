import { CandleData } from "./evaluator";
export type MarketRegime = "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "VOLATILE" | "CHOPPY";
export interface MarketContext {
    regime: MarketRegime;
    trendStrength: number;
    volatility: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
    atr: number;
    rsi: number;
    distanceFromEMA: number;
    marketStructure: "BULLISH" | "BEARISH" | "NEUTRAL";
}
export declare class MarketContextEngine {
    /**
     * Detects the current market regime based on candle data
     */
    static analyze(candles: CandleData[]): MarketContext;
    private static calculateTrend;
    private static calculateVolatility;
    private static analyzeStructure;
    private static defaultContext;
}
//# sourceMappingURL=market-context.d.ts.map