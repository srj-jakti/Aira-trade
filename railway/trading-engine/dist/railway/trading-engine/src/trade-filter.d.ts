import { MarketContext } from "./market-context";
import { Signal } from "./executor";
export interface FilterResult {
    allow: boolean;
    adjustedConfidence: number;
    reason: string;
}
export declare class TradeFilter {
    /**
     * Evaluates if a trade should be allowed based on market context and historical learning
     */
    static evaluate(signal: Signal, context: MarketContext, rlScore: any): FilterResult;
    private static checkRegimeAlignment;
}
//# sourceMappingURL=trade-filter.d.ts.map