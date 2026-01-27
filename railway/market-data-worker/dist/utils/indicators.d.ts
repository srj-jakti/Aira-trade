export interface OHLC {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export declare class TechnicalIndicators {
    /**
     * Calculates EMA (Exponential Moving Average)
     * Formula: EMA = (Price - Previous EMA) * Multiplier + Previous EMA
     * Multiplier = 2 / (Period + 1)
     */
    static calculateEMA(currentPrice: number, previousEMA: number, period: number): number;
    /**
     * Calculates RSI (Relative Strength Index)
     * Simplified version for real-time updates
     */
    static calculateRSI(prices: number[], period?: number): number;
    /**
     * Calculates SMA (Simple Moving Average)
     */
    static calculateSMA(prices: number[], period: number): number;
}
//# sourceMappingURL=indicators.d.ts.map