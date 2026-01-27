"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeFilter = void 0;
class TradeFilter {
    /**
     * Evaluates if a trade should be allowed based on market context and historical learning
     */
    static evaluate(signal, context, rlScore) {
        let confidence = signal.confidence;
        let reasons = [];
        let allow = true;
        // 1. Regime Alignment Check
        const regimeAlignment = this.checkRegimeAlignment(signal.action, context);
        if (!regimeAlignment.ok) {
            confidence -= 30;
            reasons.push(regimeAlignment.reason);
        }
        // 2. Volatility Check
        if (context.volatility === "EXTREME") {
            confidence -= 40;
            reasons.push("Extreme volatility risk");
        }
        else if (context.volatility === "HIGH") {
            confidence -= 15;
            reasons.push("High volatility caution");
        }
        // 3. RL Engine Feedback
        if (rlScore.recommendation === "STRONG_BUY") {
            confidence += 15;
            reasons.push("RL positive reinforcement");
        }
        else if (rlScore.recommendation === "STRONG_AVOID") {
            allow = false;
            reasons.push("RL strong avoid recommendation");
        }
        else if (rlScore.recommendation === "AVOID") {
            confidence -= 20;
            reasons.push("RL avoid caution");
        }
        // 4. Overextension Check
        if (Math.abs(context.distanceFromEMA) > 2.5) {
            confidence -= 25;
            reasons.push(`Price overextended (${context.distanceFromEMA.toFixed(2)}% from EMA)`);
        }
        // 5. Structure Check
        if (signal.action === "BUY" && context.marketStructure === "BEARISH") {
            confidence -= 20;
            reasons.push("Contrending trade (Bearish structure)");
        }
        else if (signal.action === "SELL" && context.marketStructure === "BULLISH") {
            confidence -= 20;
            reasons.push("Contrending trade (Bullish structure)");
        }
        // Final Decision
        confidence = Math.max(0, Math.min(100, confidence));
        if (confidence < 70) {
            allow = false;
            reasons.push(`Low final confidence (${confidence}%)`);
        }
        return {
            allow,
            adjustedConfidence: confidence,
            reason: reasons.join(", ")
        };
    }
    static checkRegimeAlignment(action, context) {
        if (action === "HOLD")
            return { ok: true, reason: "" };
        if (context.regime === "TRENDING_UP" && action === "SELL") {
            return { ok: false, reason: "Selling into strong uptrend" };
        }
        if (context.regime === "TRENDING_DOWN" && action === "BUY") {
            return { ok: false, reason: "Buying into strong downtrend" };
        }
        if (context.regime === "CHOPPY") {
            return { ok: false, reason: "Avoid trading in choppy regime" };
        }
        return { ok: true, reason: "" };
    }
}
exports.TradeFilter = TradeFilter;
//# sourceMappingURL=trade-filter.js.map