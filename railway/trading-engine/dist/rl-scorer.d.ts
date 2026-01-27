export interface RLScore {
    score: number;
    recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "AVOID" | "STRONG_AVOID";
    reasoning: string;
    confidence: number;
}
export declare function getRLScoreForInstrument(instrumentToken: number, patternType: string, timeframe: string, marketConditions: {
    trend: string;
    volatility: string;
}): Promise<RLScore>;
export declare function updateRLKnowledgeAfterTrade(instrumentToken: number, tradingSymbol: string, patternType: string, timeframe: string, tradeResult: {
    pnl: number;
    isProfit: boolean;
    riskReward: number;
    marketCondition: string;
}): Promise<void>;
export declare function extractPatternType(strategyIntent: string): string;
//# sourceMappingURL=rl-scorer.d.ts.map