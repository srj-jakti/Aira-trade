"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TechnicalIndicators = void 0;
class TechnicalIndicators {
    /**
     * Calculates EMA (Exponential Moving Average)
     * Formula: EMA = (Price - Previous EMA) * Multiplier + Previous EMA
     * Multiplier = 2 / (Period + 1)
     */
    static calculateEMA(currentPrice, previousEMA, period) {
        const multiplier = 2 / (period + 1);
        return (currentPrice - previousEMA) * multiplier + previousEMA;
    }
    /**
     * Calculates RSI (Relative Strength Index)
     * Simplified version for real-time updates
     */
    static calculateRSI(prices, period = 14) {
        if (prices.length <= period)
            return 50; // Not enough data
        let gains = 0;
        let losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) {
                gains += diff;
            }
            else {
                losses -= diff;
            }
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    /**
     * Calculates SMA (Simple Moving Average)
     */
    static calculateSMA(prices, period) {
        if (prices.length < period)
            return prices[prices.length - 1];
        const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }
}
exports.TechnicalIndicators = TechnicalIndicators;
//# sourceMappingURL=indicators.js.map