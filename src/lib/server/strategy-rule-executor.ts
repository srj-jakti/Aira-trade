import {
  type ExecutableStrategy,
  type StrategyRule,
  type RuleSet,
  type EvaluationLog,
  type ExecutionResult,
  type IndicatorType,
  type ComparisonOperator,
  getRequiredWarmupPeriod,
} from "@/lib/types/strategy";
import { IndicatorCalculator, type Candle } from "./indicator-calculator";

interface RuleEvaluationResult {
  passed: boolean;
  actualValue?: number;
  expectedValue?: number;
  reason?: string;
}

export class StrategyRuleExecutor {
  private indicatorCache: Map<string, number[]> = new Map();
  private candles: Candle[] = [];
  private debugMode: boolean = false;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  precalculateIndicators(candles: Candle[], strategy: ExecutableStrategy): void {
    this.candles = candles;
    this.indicatorCache.clear();

    const close = candles.map((c) => c.close);

    for (const ind of strategy.requiredIndicators) {
      const key = this.getIndicatorKey(ind.name, ind.period);
      
      switch (ind.name) {
        case "RSI":
          this.indicatorCache.set(key, IndicatorCalculator.calculateRSI(close, ind.period || 14));
          break;
        case "SMA":
          this.indicatorCache.set(key, IndicatorCalculator.calculateSMA(close, ind.period || 20));
          break;
        case "EMA":
          this.indicatorCache.set(key, IndicatorCalculator.calculateEMA(close, ind.period || 20));
          break;
        case "WMA":
          this.indicatorCache.set(key, IndicatorCalculator.calculateWMA(close, ind.period || 20));
          break;
        case "DEMA":
          this.indicatorCache.set(key, IndicatorCalculator.calculateDEMA(close, ind.period || 20));
          break;
        case "VWAP":
          this.indicatorCache.set(key, IndicatorCalculator.calculateVWAP(candles));
          break;
        case "MACD": {
          const macd = IndicatorCalculator.calculateMACD(close);
          this.indicatorCache.set("MACD", macd.macd);
          this.indicatorCache.set("MACD_SIGNAL", macd.signal);
          this.indicatorCache.set("MACD_HIST", macd.histogram);
          break;
        }
        case "SUPERTREND": {
          const st = IndicatorCalculator.calculateSupertrend(candles);
          this.indicatorCache.set("SUPERTREND", st.trend);
          this.indicatorCache.set("SUPERTREND_DIR", st.direction);
          break;
        }
        case "ADX":
          this.indicatorCache.set(key, IndicatorCalculator.calculateADX(candles, ind.period || 14));
          break;
        case "ATR":
          this.indicatorCache.set(key, IndicatorCalculator.calculateATR(candles, ind.period || 14));
          break;
        case "STOCH_K":
        case "STOCH_D": {
          const stoch = IndicatorCalculator.calculateStochastic(candles);
          this.indicatorCache.set("STOCH_K", stoch.k);
          this.indicatorCache.set("STOCH_D", stoch.d);
          break;
        }
        case "BB_UPPER":
        case "BB_MIDDLE":
        case "BB_LOWER": {
          const bb = IndicatorCalculator.calculateBollingerBands(close, ind.period || 20);
          this.indicatorCache.set("BB_UPPER", bb.upper);
          this.indicatorCache.set("BB_MIDDLE", bb.middle);
          this.indicatorCache.set("BB_LOWER", bb.lower);
          break;
        }
        case "OBV":
          this.indicatorCache.set(key, IndicatorCalculator.calculateOBV(candles));
          break;
      }
    }

    const defaultIndicators = [
      { name: "RSI", period: 14 },
      { name: "SMA", period: 20 },
      { name: "SMA", period: 50 },
      { name: "EMA", period: 9 },
      { name: "EMA", period: 21 },
    ];

    for (const ind of defaultIndicators) {
      const key = this.getIndicatorKey(ind.name as IndicatorType, ind.period);
      if (!this.indicatorCache.has(key)) {
        if (ind.name === "RSI") {
          this.indicatorCache.set(key, IndicatorCalculator.calculateRSI(close, ind.period));
        } else if (ind.name === "SMA") {
          this.indicatorCache.set(key, IndicatorCalculator.calculateSMA(close, ind.period));
        } else if (ind.name === "EMA") {
          this.indicatorCache.set(key, IndicatorCalculator.calculateEMA(close, ind.period));
        }
      }
    }

    if (!this.indicatorCache.has("SUPERTREND")) {
      const st = IndicatorCalculator.calculateSupertrend(candles);
      this.indicatorCache.set("SUPERTREND", st.trend);
      this.indicatorCache.set("SUPERTREND_DIR", st.direction);
    }

    if (!this.indicatorCache.has("MACD")) {
      const macd = IndicatorCalculator.calculateMACD(close);
      this.indicatorCache.set("MACD", macd.macd);
      this.indicatorCache.set("MACD_SIGNAL", macd.signal);
      this.indicatorCache.set("MACD_HIST", macd.histogram);
    }

    if (!this.indicatorCache.has("BB_UPPER")) {
      const bb = IndicatorCalculator.calculateBollingerBands(close, 20);
      this.indicatorCache.set("BB_UPPER", bb.upper);
      this.indicatorCache.set("BB_MIDDLE", bb.middle);
      this.indicatorCache.set("BB_LOWER", bb.lower);
    }

    if (!this.indicatorCache.has("STOCH_K")) {
      const stoch = IndicatorCalculator.calculateStochastic(candles);
      this.indicatorCache.set("STOCH_K", stoch.k);
      this.indicatorCache.set("STOCH_D", stoch.d);
    }

    if (!this.indicatorCache.has("ADX_14")) {
      this.indicatorCache.set("ADX_14", IndicatorCalculator.calculateADX(candles, 14));
    }

    if (!this.indicatorCache.has("ATR_14")) {
      this.indicatorCache.set("ATR_14", IndicatorCalculator.calculateATR(candles, 14));
    }

    if (!this.indicatorCache.has("OBV")) {
      this.indicatorCache.set("OBV", IndicatorCalculator.calculateOBV(candles));
    }
  }

  private getIndicatorKey(name: IndicatorType, period?: number): string {
    if (["MACD", "MACD_SIGNAL", "MACD_HIST", "SUPERTREND", "SUPERTREND_DIR", "VWAP", "OBV", "BB_UPPER", "BB_MIDDLE", "BB_LOWER", "STOCH_K", "STOCH_D"].includes(name)) {
      return name;
    }
    return `${name}_${period || 14}`;
  }

  private getIndicatorValue(name: IndicatorType, index: number, period?: number): number {
    const key = this.getIndicatorKey(name, period);
    const data = this.indicatorCache.get(key);
    if (!data || index >= data.length) return NaN;
    return data[index];
  }

  private getPriceValue(field: "open" | "high" | "low" | "close" | "volume", index: number): number {
    const candle = this.candles[index];
    if (!candle) return NaN;
    return candle[field];
  }

  private compare(left: number, operator: ComparisonOperator, right: number, prevLeft?: number, prevRight?: number): boolean {
    if (isNaN(left) || isNaN(right)) return false;

    switch (operator) {
      case ">":
        return left > right;
      case "<":
        return left < right;
      case ">=":
        return left >= right;
      case "<=":
        return left <= right;
      case "==":
        return Math.abs(left - right) < 0.0001;
      case "CROSS_ABOVE":
        if (prevLeft === undefined || prevRight === undefined || isNaN(prevLeft) || isNaN(prevRight)) return false;
        return prevLeft < prevRight && left >= right;
      case "CROSS_BELOW":
        if (prevLeft === undefined || prevRight === undefined || isNaN(prevLeft) || isNaN(prevRight)) return false;
        return prevLeft > prevRight && left <= right;
      default:
        return false;
    }
  }

  private evaluateRule(rule: StrategyRule, index: number): RuleEvaluationResult {
    const candle = this.candles[index];
    const prevCandle = index > 0 ? this.candles[index - 1] : null;

    switch (rule.type) {
      case "indicator": {
        const actualValue = this.getIndicatorValue(rule.name, index, rule.period);
        const expectedValue = rule.value;
        const prevActual = index > 0 ? this.getIndicatorValue(rule.name, index - 1, rule.period) : undefined;

        if (isNaN(actualValue)) {
          return {
            passed: false,
            actualValue,
            expectedValue,
            reason: `${rule.name} value is NaN (insufficient data)`,
          };
        }

        const passed = this.compare(actualValue, rule.operator, expectedValue, prevActual, expectedValue);
        return {
          passed,
          actualValue,
          expectedValue,
          reason: passed
            ? `${rule.name}(${rule.period || 14}) = ${actualValue.toFixed(2)} ${rule.operator} ${expectedValue}`
            : `${rule.name}(${rule.period || 14}) = ${actualValue.toFixed(2)} NOT ${rule.operator} ${expectedValue}`,
        };
      }

      case "price_vs_indicator": {
        const priceValue = this.getPriceValue(rule.priceField, index);
        const indicatorValue = this.getIndicatorValue(rule.indicator, index, rule.indicatorPeriod);
        const prevPrice = index > 0 ? this.getPriceValue(rule.priceField, index - 1) : undefined;
        const prevIndicator = index > 0 ? this.getIndicatorValue(rule.indicator, index - 1, rule.indicatorPeriod) : undefined;

        if (isNaN(indicatorValue)) {
          return {
            passed: false,
            actualValue: priceValue,
            expectedValue: indicatorValue,
            reason: `${rule.indicator} value is NaN`,
          };
        }

        const passed = this.compare(priceValue, rule.operator, indicatorValue, prevPrice, prevIndicator);
        return {
          passed,
          actualValue: priceValue,
          expectedValue: indicatorValue,
          reason: passed
            ? `${rule.priceField} (${priceValue.toFixed(2)}) ${rule.operator} ${rule.indicator}(${indicatorValue.toFixed(2)})`
            : `${rule.priceField} (${priceValue.toFixed(2)}) NOT ${rule.operator} ${rule.indicator}(${indicatorValue.toFixed(2)})`,
        };
      }

      case "indicator_vs_indicator": {
        const val1 = this.getIndicatorValue(rule.indicator1, index, rule.period1);
        const val2 = this.getIndicatorValue(rule.indicator2, index, rule.period2);
        const prevVal1 = index > 0 ? this.getIndicatorValue(rule.indicator1, index - 1, rule.period1) : undefined;
        const prevVal2 = index > 0 ? this.getIndicatorValue(rule.indicator2, index - 1, rule.period2) : undefined;

        if (isNaN(val1) || isNaN(val2)) {
          return {
            passed: false,
            actualValue: val1,
            expectedValue: val2,
            reason: `Indicator values are NaN`,
          };
        }

        const passed = this.compare(val1, rule.operator, val2, prevVal1, prevVal2);
        return {
          passed,
          actualValue: val1,
          expectedValue: val2,
          reason: passed
            ? `${rule.indicator1} (${val1.toFixed(2)}) ${rule.operator} ${rule.indicator2} (${val2.toFixed(2)})`
            : `${rule.indicator1} (${val1.toFixed(2)}) NOT ${rule.operator} ${rule.indicator2} (${val2.toFixed(2)})`,
        };
      }

      case "trend": {
        if (rule.indicator === "SUPERTREND") {
          const dir = this.getIndicatorValue("SUPERTREND_DIR" as IndicatorType, index);
          if (isNaN(dir)) {
            return { passed: false, reason: "Supertrend direction not available" };
          }
          const passed = rule.direction === "BULLISH" ? dir === 1 : dir === -1;
          return {
            passed,
            actualValue: dir,
            reason: passed
              ? `Supertrend is ${rule.direction}`
              : `Supertrend is ${dir === 1 ? "BULLISH" : "BEARISH"}, expected ${rule.direction}`,
          };
        } else if (rule.indicator === "ADX") {
          const adx = this.getIndicatorValue("ADX", index, 14);
          const threshold = rule.threshold || 25;
          if (isNaN(adx)) {
            return { passed: false, reason: "ADX value not available" };
          }
          const passed = adx > threshold;
          return {
            passed,
            actualValue: adx,
            expectedValue: threshold,
            reason: passed
              ? `ADX (${adx.toFixed(2)}) > ${threshold} (strong trend)`
              : `ADX (${adx.toFixed(2)}) <= ${threshold} (weak trend)`,
          };
        }
        return { passed: false, reason: "Unknown trend indicator" };
      }

      case "pattern": {
        if (!candle) return { passed: false, reason: "No candle data" };
        
        let passed = false;
        switch (rule.pattern) {
          case "HAMMER":
            passed = IndicatorCalculator.isHammer(candle, prevCandle);
            break;
          case "SHOOTING_STAR":
            passed = IndicatorCalculator.isShootingStar(candle);
            break;
          case "DOJI":
            passed = IndicatorCalculator.isDoji(candle);
            break;
          case "BULLISH_ENGULFING":
            passed = prevCandle ? IndicatorCalculator.isEngulfing(candle, prevCandle).bullish : false;
            break;
          case "BEARISH_ENGULFING":
            passed = prevCandle ? IndicatorCalculator.isEngulfing(candle, prevCandle).bearish : false;
            break;
          default:
            return { passed: false, reason: `Pattern ${rule.pattern} not implemented` };
        }
        return {
          passed,
          reason: passed ? `${rule.pattern} pattern detected` : `${rule.pattern} pattern not found`,
        };
      }

      case "price_action": {
        if (!candle) return { passed: false, reason: "No candle data" };

        let passed = false;
        switch (rule.action) {
          case "BULLISH_CANDLE":
            passed = candle.close > candle.open;
            break;
          case "BEARISH_CANDLE":
            passed = candle.close < candle.open;
            break;
          case "HIGHER_HIGH":
            passed = prevCandle ? candle.high > prevCandle.high : false;
            break;
          case "LOWER_LOW":
            passed = prevCandle ? candle.low < prevCandle.low : false;
            break;
          case "HIGHER_LOW":
            passed = prevCandle ? candle.low > prevCandle.low : false;
            break;
          case "LOWER_HIGH":
            passed = prevCandle ? candle.high < prevCandle.high : false;
            break;
        }
        return {
          passed,
          reason: passed ? `${rule.action} confirmed` : `${rule.action} not confirmed`,
        };
      }

      case "volume": {
        if (!candle) return { passed: false, reason: "No candle data" };

        let compareValue: number;
        if (rule.compareToAverage) {
          const period = rule.averagePeriod || 20;
          const volSma = IndicatorCalculator.calculateSMA(
            this.candles.map((c) => c.volume),
            period
          );
          compareValue = volSma[index];
        } else {
          compareValue = rule.value || 100000;
        }

        if (isNaN(compareValue)) {
          return { passed: false, reason: "Volume average not available" };
        }

        const passed = this.compare(candle.volume, rule.operator, compareValue);
        return {
          passed,
          actualValue: candle.volume,
          expectedValue: compareValue,
          reason: passed
            ? `Volume (${candle.volume}) ${rule.operator} ${compareValue.toFixed(0)}`
            : `Volume (${candle.volume}) NOT ${rule.operator} ${compareValue.toFixed(0)}`,
        };
      }

      default:
        return { passed: false, reason: "Unknown rule type" };
    }
  }

  private evaluateRuleSet(ruleSet: RuleSet, index: number): { result: boolean; ruleResults: Array<{ rule: StrategyRule; passed: boolean; actualValue?: number; expectedValue?: number; reason?: string }> } {
    const ruleResults: Array<{ rule: StrategyRule; passed: boolean; actualValue?: number; expectedValue?: number; reason?: string }> = [];

    for (const rule of ruleSet.rules) {
      const evalResult = this.evaluateRule(rule, index);
      ruleResults.push({
        rule,
        ...evalResult,
      });
    }

    let result: boolean;
    if (ruleSet.logic === "AND") {
      result = ruleResults.every((r) => r.passed);
    } else {
      result = ruleResults.some((r) => r.passed);
    }

    return { result, ruleResults };
  }

  evaluate(strategy: ExecutableStrategy, index: number): ExecutionResult {
    const candle = this.candles[index];
    const warmupPeriod = getRequiredWarmupPeriod(strategy);

    if (index < warmupPeriod) {
      return {
        buySignal: false,
        sellSignal: false,
        holdInfo: false,
        log: {
          candle: {
            index,
            timestamp: candle?.timestamp || "",
            open: candle?.open || 0,
            high: candle?.high || 0,
            low: candle?.low || 0,
            close: candle?.close || 0,
            volume: candle?.volume || 0,
          },
          buyEvaluation: { result: false, ruleResults: [] },
          sellEvaluation: { result: false, ruleResults: [] },
          finalSignal: "HOLD",
          signalReason: `Warmup period (index ${index} < ${warmupPeriod})`,
        },
        indicatorValues: {},
      };
    }

    if (index === warmupPeriod && this.debugMode) {
      console.log(`[Executor] First evaluation at index ${index}`);
      console.log(`[Executor] BUY rules: ${strategy.buy.rules.length}, logic: ${strategy.buy.logic}`);
      console.log(`[Executor] SELL rules: ${strategy.sell.rules.length}, logic: ${strategy.sell.logic}`);
      console.log(`[Executor] Sample indicator values at index ${index}:`, {
        RSI_14: this.indicatorCache.get("RSI_14")?.[index],
        EMA_20: this.indicatorCache.get("EMA_20")?.[index],
        SUPERTREND_DIR: this.indicatorCache.get("SUPERTREND_DIR")?.[index],
      });
    }

    const buyEval = this.evaluateRuleSet(strategy.buy, index);
    const sellEval = this.evaluateRuleSet(strategy.sell, index);
    const holdEval = strategy.hold ? this.evaluateRuleSet(strategy.hold, index) : { result: false, ruleResults: [] };

    let finalSignal: "BUY" | "SELL" | "HOLD" = "HOLD";
    let signalReason = "";

    // Signal Priority: 
    // 1. If HOLD condition is met, it overrides entry signals (unless the user meant HOLD as "keep position", but here we use it as "no trade")
    // 2. If both BUY and SELL are met, it's a conflict -> HOLD
    // 3. EXIT signals are handled by the backtest engine separately, but here we focus on ENTRY.

    if (holdEval.result) {
      finalSignal = "HOLD";
      signalReason = `HOLD condition met: ${holdEval.ruleResults.filter(r => r.passed).map(r => r.reason).join(", ")}`;
    } else if (buyEval.result && !sellEval.result) {
      finalSignal = "BUY";
      signalReason = `BUY conditions met (${strategy.buy.logic}): ${buyEval.ruleResults.filter(r => r.passed).map(r => r.reason).join(", ")}`;
    } else if (sellEval.result && !buyEval.result) {
      finalSignal = "SELL";
      signalReason = `SELL conditions met (${strategy.sell.logic}): ${sellEval.ruleResults.filter(r => r.passed).map(r => r.reason).join(", ")}`;
    } else if (buyEval.result && sellEval.result) {
      finalSignal = "HOLD";
      signalReason = "Conflicting signals: both BUY and SELL conditions met";
    } else {
      finalSignal = "HOLD";
      const failedBuyRules = buyEval.ruleResults.filter(r => !r.passed);
      const failedSellRules = sellEval.ruleResults.filter(r => !r.passed);
      signalReason = `No entry conditions met. BUY failed: [${failedBuyRules.map(r => r.reason).join(" | ")}]. SELL failed: [${failedSellRules.map(r => r.reason).join(" | ")}]`;
    }

    const indicatorValues: Record<string, number> = {};
    for (const [key, values] of this.indicatorCache.entries()) {
      if (values[index] !== undefined && !isNaN(values[index])) {
        indicatorValues[key] = values[index];
      }
    }

    return {
      buySignal: finalSignal === "BUY",
      sellSignal: finalSignal === "SELL",
      holdInfo: holdEval.result,
      log: {
        candle: {
          index,
          timestamp: candle?.timestamp || "",
          open: candle?.open || 0,
          high: candle?.high || 0,
          low: candle?.low || 0,
          close: candle?.close || 0,
          volume: candle?.volume || 0,
        },
        buyEvaluation: buyEval,
        sellEvaluation: sellEval,
        holdEvaluation: strategy.hold ? holdEval : undefined,
        finalSignal,
        signalReason,
      },
      indicatorValues,
    };
  }

  getIndicatorCache(): Map<string, number[]> {
    return this.indicatorCache;
  }
}

export function formatEvaluationLogForDisplay(log: EvaluationLog): string {
  const lines: string[] = [];
  
  lines.push(`Candle ${log.candle.index} @ ${log.candle.timestamp}`);
  lines.push(`  O: ${log.candle.open.toFixed(2)} H: ${log.candle.high.toFixed(2)} L: ${log.candle.low.toFixed(2)} C: ${log.candle.close.toFixed(2)} V: ${log.candle.volume}`);
  lines.push("");
  
  lines.push(`BUY Evaluation: ${log.buyEvaluation.result ? "✅ PASS" : "❌ FAIL"}`);
  for (const r of log.buyEvaluation.ruleResults) {
    lines.push(`  ${r.passed ? "✅" : "❌"} ${r.reason || "Unknown"}`);
  }
  lines.push("");
  
  lines.push(`SELL Evaluation: ${log.sellEvaluation.result ? "✅ PASS" : "❌ FAIL"}`);
  for (const r of log.sellEvaluation.ruleResults) {
    lines.push(`  ${r.passed ? "✅" : "❌"} ${r.reason || "Unknown"}`);
  }
  lines.push("");
  
  lines.push(`➡️ FINAL SIGNAL: ${log.finalSignal}`);
  lines.push(`   Reason: ${log.signalReason}`);
  
  return lines.join("\n");
}
