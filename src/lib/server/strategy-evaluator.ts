
import { IndicatorCalculator, type Candle } from "./indicator-calculator";
import { type StructuredStrategy } from "./strategy-service";

export interface EvaluationResult {
  buySignal: boolean;
  sellSignal: boolean;
  holdSignal: boolean;
  indicatorData: Record<string, any>;
}

export class StrategyEvaluator {
  static precalculateIndicators(candles: Candle[]): Record<string, any> {
    const data: Record<string, any> = {};
    const close = candles.map(c => c.close);
    
    // Core Indicators
    data["rsi_14"] = IndicatorCalculator.calculateRSI(close, 14);
    data["sma_20"] = IndicatorCalculator.calculateSMA(close, 20);
    data["sma_50"] = IndicatorCalculator.calculateSMA(close, 50);
    data["sma_200"] = IndicatorCalculator.calculateSMA(close, 200);
    data["ema_9"] = IndicatorCalculator.calculateEMA(close, 9);
    data["ema_21"] = IndicatorCalculator.calculateEMA(close, 21);
    data["ema_50"] = IndicatorCalculator.calculateEMA(close, 50);
    data["wma_20"] = IndicatorCalculator.calculateWMA(close, 20);
    data["dema_20"] = IndicatorCalculator.calculateDEMA(close, 20);
    data["vwap"] = IndicatorCalculator.calculateVWAP(candles);
    
    const macd = IndicatorCalculator.calculateMACD(close);
    data["macd_line"] = macd.macd;
    data["macd_signal"] = macd.signal;
    data["macd_hist"] = macd.histogram;

    const bb = IndicatorCalculator.calculateBollingerBands(close);
    data["bb_upper"] = bb.upper;
    data["bb_middle"] = bb.middle;
    data["bb_lower"] = bb.lower;

    const st = IndicatorCalculator.calculateSupertrend(candles);
    data["supertrend"] = st.trend;
    data["supertrend_dir"] = st.direction;

    data["atr_14"] = IndicatorCalculator.calculateATR(candles);
    data["obv"] = IndicatorCalculator.calculateOBV(candles);
    data["adx_14"] = IndicatorCalculator.calculateADX(candles);

    const stoch = IndicatorCalculator.calculateStochastic(candles);
    data["stoch_k"] = stoch.k;
    data["stoch_d"] = stoch.d;

    return data;
  }

  static evaluate(
    strategy: StructuredStrategy,
    candles: Candle[],
    index: number,
    indicatorData: Record<string, any>
  ): EvaluationResult {
    const checkCondition = (condition: string, idx: number): boolean => {
      const lowerCond = condition.toLowerCase().trim();
      const candle = candles[idx];
      const prevCandle = idx > 0 ? candles[idx - 1] : null;

      // Helper to extract numbers from string
      const extractNumbers = (str: string) => {
        return (str.match(/\d+(\.\d+)?/g) || []).map(Number);
      };

      // Helper to check numeric comparison
      const checkComparison = (val: number, cond: string, defaultThreshold: number): boolean => {
        const nums = extractNumbers(cond);
        // If there's a bracketed period like RSI(14), the first number is the period.
        // We want the last number as the threshold if there's more than one.
        const threshold = nums.length > 1 ? nums[nums.length - 1] : (nums[0] ?? defaultThreshold);
        
        if (cond.includes(">=")) return val >= threshold;
        if (cond.includes("<=")) return val <= threshold;
        if (cond.includes(">") || cond.includes("above")) return val > threshold;
        if (cond.includes("<") || cond.includes("below")) return val < threshold;
        if (cond.includes("==") || cond.includes("equal")) return val === threshold;
        return false;
      };

      // 1. RSI
      if (lowerCond.includes("rsi")) {
        const nums = extractNumbers(lowerCond);
        const period = nums.length > 1 ? nums[0] : 14;
        const key = `rsi_${period}`;
        
        if (!indicatorData[key]) {
          indicatorData[key] = IndicatorCalculator.calculateRSI(candles.map(c => c.close), period);
        }
        
        const rsi = indicatorData[key][idx];
        if (isNaN(rsi)) return false;

        if (lowerCond.includes("crosses above")) {
          const threshold = nums.length > 1 ? nums[nums.length - 1] : 30;
          return idx > 0 && indicatorData[key][idx - 1] < threshold && rsi >= threshold;
        }
        if (lowerCond.includes("crosses below")) {
          const threshold = nums.length > 1 ? nums[nums.length - 1] : 70;
          return idx > 0 && indicatorData[key][idx - 1] > threshold && rsi <= threshold;
        }
        
        return checkComparison(rsi, lowerCond, 50);
      }

      // 2. MA (SMA, EMA, WMA, DEMA, VWAP)
      if (lowerCond.includes("sma") || lowerCond.includes("ema") || lowerCond.includes("wma") || lowerCond.includes("dema") || lowerCond.includes("vwap")) {
        let type = "sma";
        if (lowerCond.includes("ema")) type = "ema";
        else if (lowerCond.includes("wma")) type = "wma";
        else if (lowerCond.includes("dema")) type = "dema";
        else if (lowerCond.includes("vwap")) type = "vwap";

        const nums = extractNumbers(lowerCond);
        const period = type === "vwap" ? 0 : (nums[0] || 20);
        const key = type === "vwap" ? "vwap" : `${type}_${period}`;
        
        if (!indicatorData[key]) {
          const close = candles.map(c => c.close);
          if (type === "sma") indicatorData[key] = IndicatorCalculator.calculateSMA(close, period);
          else if (type === "ema") indicatorData[key] = IndicatorCalculator.calculateEMA(close, period);
          else if (type === "wma") indicatorData[key] = IndicatorCalculator.calculateWMA(close, period);
          else if (type === "dema") indicatorData[key] = IndicatorCalculator.calculateDEMA(close, period);
          else if (type === "vwap") indicatorData[key] = IndicatorCalculator.calculateVWAP(candles);
        }

        const ma = indicatorData[key][idx];
        const prevMa = idx > 0 ? indicatorData[key][idx - 1] : NaN;
        if (isNaN(ma)) return false;

        // Price vs MA
        if (lowerCond.includes("price")) {
          if (lowerCond.includes("crosses above")) return prevCandle && prevCandle.close < prevMa && candle.close >= ma;
          if (lowerCond.includes("crosses below")) return prevCandle && prevCandle.close > prevMa && candle.close <= ma;
          if (lowerCond.includes(">") || lowerCond.includes("above")) return candle.close > ma;
          if (lowerCond.includes("<") || lowerCond.includes("below")) return candle.close < ma;
        }

        // MA vs MA (Crossover)
        if (lowerCond.includes("crosses above") || lowerCond.includes("crosses below")) {
           // If we have two indicators like "EMA(9) crosses above EMA(21)"
           // This is complex for a simple parser, but let's try to find if there's a second period
           if (nums.length >= 2) {
             const period2 = nums[1];
             const key2 = `${type}_${period2}`;
             if (!indicatorData[key2]) {
               if (type === "ema") indicatorData[key2] = IndicatorCalculator.calculateEMA(candles.map(c => c.close), period2);
               else if (type === "sma") indicatorData[key2] = IndicatorCalculator.calculateSMA(candles.map(c => c.close), period2);
             }
             const ma2 = indicatorData[key2][idx];
             const prevMa2 = idx > 0 ? indicatorData[key2][idx - 1] : NaN;
             if (isNaN(ma2)) return false;

             if (lowerCond.includes("crosses above")) return prevMa < prevMa2 && ma >= ma2;
             if (lowerCond.includes("crosses below")) return prevMa > prevMa2 && ma <= ma2;
           }
        }
        
        // Default to Price > MA if just "Price above EMA"
        if (lowerCond.includes("above") || lowerCond.includes(">")) return candle.close > ma;
        if (lowerCond.includes("below") || lowerCond.includes("<")) return candle.close < ma;
      }

      // 3. MACD
      if (lowerCond.includes("macd")) {
        const line = indicatorData["macd_line"][idx];
        const signal = indicatorData["macd_signal"][idx];
        const hist = indicatorData["macd_hist"][idx];
        if (isNaN(line) || isNaN(signal)) return false;

        if (lowerCond.includes("crosses above signal")) return idx > 0 && indicatorData["macd_line"][idx-1] < indicatorData["macd_signal"][idx-1] && line >= signal;
        if (lowerCond.includes("crosses below signal")) return idx > 0 && indicatorData["macd_line"][idx-1] > indicatorData["macd_signal"][idx-1] && line <= signal;
        if (lowerCond.includes("above zero")) return line > 0;
        if (lowerCond.includes("below zero")) return line < 0;
        if (lowerCond.includes("histogram > 0")) return hist > 0;
      }

      // 4. Supertrend
      if (lowerCond.includes("supertrend")) {
        const dir = indicatorData["supertrend_dir"][idx];
        if (lowerCond.includes("bullish") || lowerCond.includes("buy")) return dir === 1;
        if (lowerCond.includes("bearish") || lowerCond.includes("sell")) return dir === -1;
      }

      // 5. Stochastic
      if (lowerCond.includes("stochastic")) {
        const k = indicatorData["stoch_k"][idx];
        const d = indicatorData["stoch_d"][idx];
        if (isNaN(k) || isNaN(d)) return false;
        if (lowerCond.includes("crosses above d")) return idx > 0 && indicatorData["stoch_k"][idx-1] < indicatorData["stoch_d"][idx-1] && k >= d;
        if (lowerCond.includes("above 80")) return k > 80;
        if (lowerCond.includes("below 20")) return k < 20;
      }

      // 6. ADX
      if (lowerCond.includes("adx")) {
        const adx = indicatorData["adx_14"][idx];
        if (isNaN(adx)) return false;
        return checkComparison(adx, lowerCond, 25);
      }

      // 7. Bollinger Bands
      if (lowerCond.includes("bollinger") || lowerCond.includes("bb")) {
        if (lowerCond.includes("upper")) return candle.close > indicatorData["bb_upper"][idx];
        if (lowerCond.includes("lower")) return candle.close < indicatorData["bb_lower"][idx];
        if (lowerCond.includes("middle")) return candle.close > indicatorData["bb_middle"][idx];
      }

      // 8. Patterns
      if (lowerCond.includes("hammer")) return IndicatorCalculator.isHammer(candle, prevCandle);
      if (lowerCond.includes("shooting star")) return IndicatorCalculator.isShootingStar(candle);
      if (lowerCond.includes("engulfing")) {
        if (!prevCandle) return false;
        const res = IndicatorCalculator.isEngulfing(candle, prevCandle);
        return lowerCond.includes("bullish") ? res.bullish : res.bearish;
      }
      if (lowerCond.includes("doji")) return IndicatorCalculator.isDoji(candle);

      // 9. Volume
      if (lowerCond.includes("volume")) {
        if (lowerCond.includes("above average")) {
          const volSma = IndicatorCalculator.calculateSMA(candles.map(c => c.volume), 20);
          return candle.volume > volSma[idx];
        }
        if (lowerCond.includes("obv rising")) return idx > 0 && indicatorData["obv"][idx] > indicatorData["obv"][idx-1];
        
        // Numeric volume comparison like "Volume > 100000"
        return checkComparison(candle.volume, lowerCond, 100000);
      }

      // 10. Price Action
      if (lowerCond.includes("bullish candle")) return candle.close > candle.open;
      if (lowerCond.includes("bearish candle")) return candle.close < candle.open;
      if (lowerCond.includes("higher high")) return prevCandle && candle.high > prevCandle.high;
      if (lowerCond.includes("lower low")) return prevCandle && candle.low < prevCandle.low;

      // Default: If unknown, don't break the 'every' check if it's not a critical error
      // But return false to be safe for signals
      return false;
    };

    const check = (logic: any) => {
      if (!logic || !logic.conditions || logic.conditions.length === 0) return false;
      // We use every() because all conditions in buy_entry_logic must be true
      return logic.conditions.every((c: string) => checkCondition(c, index));
    };

    return {
      buySignal: check(strategy.buy_entry_logic),
      sellSignal: check(strategy.sell_entry_logic),
      holdSignal: check(strategy.hold_logic),
      indicatorData
    };
  }
}
