"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketContextEngine = void 0;
class MarketContextEngine {
    /**
     * Detects the current market regime based on candle data
     */
    static analyze(candles) {
        if (candles.length < 20) {
            return this.defaultContext();
        }
        const last = candles[candles.length - 1];
        const closes = candles.map(c => c.close);
        // 1. Trend Analysis (ADX & Direction)
        const trend = this.calculateTrend(candles);
        // 2. Volatility Analysis (ATR relative to price)
        const volatilityData = this.calculateVolatility(candles);
        // 3. Market Structure (HH/HL vs LH/LL)
        const structure = this.analyzeStructure(candles);
        // 4. Momentum (RSI)
        const rsi = last.indicators?.RSI_14 || 50;
        // 5. Distance from EMA20
        const ema20 = last.indicators?.EMA_20 || last.indicators?.EMA_21 || last.close;
        const distFromEMA = ((last.close - ema20) / ema20) * 100;
        // Determine Regime
        let regime = "RANGING";
        if (volatilityData.level === "EXTREME") {
            regime = "VOLATILE";
        }
        else if (trend.strength > 25) {
            regime = trend.direction === "UP" ? "TRENDING_UP" : "TRENDING_DOWN";
        }
        else if (trend.strength < 15 && volatilityData.level === "HIGH") {
            regime = "CHOPPY";
        }
        return {
            regime,
            trendStrength: trend.strength,
            volatility: volatilityData.level,
            atr: volatilityData.atr,
            rsi,
            distanceFromEMA: distFromEMA,
            marketStructure: structure
        };
    }
    static calculateTrend(candles) {
        const last = candles[candles.length - 1];
        const adx = last.indicators?.ADX || 20; // Fallback if not present
        // Simple price action trend
        const recentCloses = candles.slice(-20).map(c => c.close);
        const first = recentCloses[0];
        const current = recentCloses[recentCloses.length - 1];
        const change = ((current - first) / first) * 100;
        let direction = "NEUTRAL";
        if (change > 0.5)
            direction = "UP";
        else if (change < -0.5)
            direction = "DOWN";
        return { strength: adx, direction };
    }
    static calculateVolatility(candles) {
        // Calculate ATR (Simple version if not in indicators)
        const last = candles[candles.length - 1];
        let atr = last.indicators?.ATR || 0;
        if (atr === 0) {
            const ranges = candles.slice(-14).map(c => c.high - c.low);
            atr = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        }
        const atrPercent = (atr / last.close) * 100;
        let level = "NORMAL";
        if (atrPercent < 0.2)
            level = "LOW";
        else if (atrPercent > 1.5)
            level = "EXTREME";
        else if (atrPercent > 0.8)
            level = "HIGH";
        return { level, atr };
    }
    static analyzeStructure(candles) {
        if (candles.length < 10)
            return "NEUTRAL";
        const recent = candles.slice(-10);
        let higherHighs = 0;
        let higherLows = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i].high > recent[i - 1].high)
                higherHighs++;
            if (recent[i].low > recent[i - 1].low)
                higherLows++;
        }
        if (higherHighs >= 6 && higherLows >= 6)
            return "BULLISH";
        if (higherHighs <= 3 && higherLows <= 3)
            return "BEARISH";
        return "NEUTRAL";
    }
    static defaultContext() {
        return {
            regime: "RANGING",
            trendStrength: 0,
            volatility: "NORMAL",
            atr: 0,
            rsi: 50,
            distanceFromEMA: 0,
            marketStructure: "NEUTRAL"
        };
    }
}
exports.MarketContextEngine = MarketContextEngine;
//# sourceMappingURL=market-context.js.map