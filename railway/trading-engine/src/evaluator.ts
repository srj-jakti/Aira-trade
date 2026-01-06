
import { supabase } from "./utils/supabase";
import { logger } from "./utils/logger";
import { Signal } from "./executor";
import { createDecipheriv } from "crypto";
import { processZairothSafe, evaluateSafety } from "../../../src/lib/zairoth";

const ALGORITHM = "aes-256-gcm";

const MIN_CANDLES_FOR_EVALUATION = 20;
const RECOMMENDED_CANDLES = 50;

// Signal Memory Window types
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
}

// In-memory persistent state for Signal Memory
const signalMemoryState = new Map<string, { memory: SignalMemory[], setup: TradeSetup }>();
const SIGNAL_WINDOW = 5;

function getSetupKey(userId: string, strategyId: string, instrumentToken: number): string {
  return `${userId}:${strategyId}:${instrumentToken}`;
}

function getRuleName(rule: any): string {
  switch (rule.type) {
    case "indicator": return `${rule.name}(${rule.period || 14})`;
    case "price_vs_indicator": return `Price vs ${rule.indicator}(${rule.indicatorPeriod})`;
    case "indicator_vs_indicator": return `${rule.indicator1} vs ${rule.indicator2}`;
    case "trend": return `${rule.indicator} ${rule.direction || ""}`;
    case "pattern": return rule.pattern || "Pattern";
    case "price_action": return rule.action || "Price Action";
    case "volume": return "Volume";
    default: return "Unknown";
  }
}

function classifyRuleRole(rule: any, ruleIndex: number, totalRules: number): SignalRole {
  if (rule.type === "trend" && rule.indicator === "SUPERTREND") return "INTENT";
  if (rule.type === "price_vs_indicator" && (rule.operator === "CROSS_ABOVE" || rule.operator === "CROSS_BELOW")) return "INTENT";
  if (rule.type === "indicator_vs_indicator" && (rule.operator === "CROSS_ABOVE" || rule.operator === "CROSS_BELOW")) return "INTENT";
  
  if (rule.type === "indicator" && rule.name === "RSI") return "CONFIRMATION";
  if (rule.type === "indicator" && rule.name === "ADX") return "CONFIRMATION";
  
  if (ruleIndex === 0) return "INTENT";
  return "CONFIRMATION";
}

export async function evaluateWithAI(
  strategy: Strategy,
  candles: CandleData[],
  userConfig: { risk_per_trade: number; max_daily_loss: number; user_id: string; capital_used?: number }
): Promise<Signal | null> {
  const instrumentToken = candles.length > 0 ? candles[0].instrument_token : null;
  if (!instrumentToken) return null;

  // Zairoth Validation Check
  if (strategy.zairoth_intent) {
    const zairoth = processZairothSafe(strategy.zairoth_intent);
    if (zairoth.success) {
      const safety = evaluateSafety(zairoth.result.instructions, { 
        capital_used: userConfig.capital_used || 0,
        risk_per_trade: userConfig.risk_per_trade 
      });
      if (!safety.safe) {
        logger.warn(`[ZAIROTH] Safety check failed for ${strategy.name}: ${safety.reason}`);
        return null; // Block trade
      }
    }
  }

  const ruleResult = evaluateWithRules(strategy, candles, userConfig.user_id);
  if (ruleResult) return ruleResult;

  const aiConfig = await getActiveAIConfig();
  if (!aiConfig) return null;

  const instrumentCandles = candles
    .filter(c => c.instrument_token === instrumentToken)
    .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime());

  const recentCandles = instrumentCandles.slice(-10);
  const messages = [
    {
      role: "system",
      content: `You are a trading signal generator. Analyze price data and strategy rules.
Respond ONLY with JSON: {"signal":"BUY"|"SELL"|"HOLD","confidence":0-100,"reasoning":"brief"}`,
    },
    {
      role: "user",
      content: `Analyze data for ${strategy.name}. 
Recent candles: ${JSON.stringify(recentCandles)}
Buy Logic: ${JSON.stringify(strategy.buy_entry_logic)}
Sell Logic: ${JSON.stringify(strategy.sell_entry_logic)}`,
    },
  ];

  const result = await callAI(aiConfig, messages);
  if (!result) return null;

  try {
    const parsed = JSON.parse(result);
    if (parsed.signal === "HOLD") return null;

    const last = instrumentCandles[instrumentCandles.length - 1];
    return {
      action: parsed.signal as "BUY" | "SELL",
      instrument: `TOKEN_${last.instrument_token}`,
      instrumentToken: last.instrument_token,
      price: last.close,
      stopLoss: last.close * (parsed.signal === "BUY" ? 0.98 : 1.02),
      target: last.close * (parsed.signal === "BUY" ? 1.04 : 0.96),
      confidence: parsed.confidence || 50,
      reasoning: parsed.reasoning,
    };
  } catch {
    return null;
  }
}

function evaluateExecutableRule(rule: any, candles: CandleData[], index: number, indicatorCache: Map<string, number[]>): boolean {
  const candle = candles[index];
  const prevCandle = index > 0 ? candles[index - 1] : null;

  const getIndicator = (name: string, period?: number): number => {
    const key = period ? `${name}_${period}` : name;
    const data = indicatorCache.get(key);
    return data ? data[index] : NaN;
  };

  const compare = (left: number, op: string, right: number, prevLeft?: number, prevRight?: number): boolean => {
    if (isNaN(left) || isNaN(right)) return false;
    switch (op) {
      case ">": return left > right;
      case "<": return left < right;
      case ">=": return left >= right;
      case "<=": return left <= right;
      case "==": return Math.abs(left - right) < 0.0001;
      case "CROSS_ABOVE":
        return prevLeft !== undefined && prevRight !== undefined && !isNaN(prevLeft) && !isNaN(prevRight) && prevLeft < prevRight && left >= right;
      case "CROSS_BELOW":
        return prevLeft !== undefined && prevRight !== undefined && !isNaN(prevLeft) && !isNaN(prevRight) && prevLeft > prevRight && left <= right;
      default: return false;
    }
  };

  switch (rule.type) {
    case "indicator": {
      const val = getIndicator(rule.name, rule.period);
      const prevVal = index > 0 ? (indicatorCache.get(`${rule.name}_${rule.period || 14}`)?.[index - 1] ?? NaN) : NaN;
      return compare(val, rule.operator, rule.value, prevVal, rule.value);
    }
    case "price_vs_indicator": {
      const price = candle[rule.priceField as keyof CandleData] as number;
      const indVal = getIndicator(rule.indicator, rule.indicatorPeriod);
      const prevPrice = prevCandle ? (prevCandle[rule.priceField as keyof CandleData] as number) : NaN;
      const prevInd = index > 0 ? (indicatorCache.get(`${rule.indicator}_${rule.indicatorPeriod || 14}`)?.[index - 1] ?? NaN) : NaN;
      return compare(price, rule.operator, indVal, prevPrice, prevInd);
    }
    case "trend": {
      if (rule.indicator === "SUPERTREND") {
        const dir = getIndicator("SUPERTREND_DIR");
        return rule.direction === "BULLISH" ? dir === 1 : dir === -1;
      } else if (rule.indicator === "ADX") {
        const adx = getIndicator("ADX", 14);
        return adx > (rule.threshold || 25);
      }
      return false;
    }
    case "pattern": {
      if (rule.pattern === "BULLISH_CANDLE") return candle.close > candle.open;
      if (rule.pattern === "BEARISH_CANDLE") return candle.close < candle.open;
      return false;
    }
    case "price_action": {
      if (rule.action === "BULLISH_CANDLE") return candle.close > candle.open;
      if (rule.action === "BEARISH_CANDLE") return candle.close < candle.open;
      if (rule.action === "HIGHER_HIGH") return prevCandle ? candle.high > prevCandle.high : false;
      if (rule.action === "LOWER_LOW") return prevCandle ? candle.low < prevCandle.low : false;
      return false;
    }
    case "volume": {
      const vol = candle.volume;
      return compare(vol, rule.operator, rule.value || 100000);
    }
    default:
      return false;
  }
}

function calculateSimpleIndicators(candles: CandleData[]): Map<string, number[]> {
  const cache = new Map<string, number[]>();
  const closes = candles.map(c => c.close);
  const n = candles.length;

  const calcSMA = (period: number): number[] => {
    const result = new Array(n).fill(NaN);
    for (let i = period - 1; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += closes[i - j];
      result[i] = sum / period;
    }
    return result;
  };

  const calcEMA = (period: number): number[] => {
    const result = new Array(n).fill(NaN);
    const mult = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 0; i < n; i++) {
      ema = (closes[i] - ema) * mult + ema;
      if (i >= period - 1) result[i] = ema;
    }
    return result;
  };

  const calcRSI = (period: number): number[] => {
    const result = new Array(n).fill(NaN);
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period && i < n; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = period; i < n; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result[i] = 100 - (100 / (1 + rs));
    }
    return result;
  };

  cache.set("RSI_14", calcRSI(14));
  cache.set("SMA_20", calcSMA(20));
  cache.set("SMA_50", calcSMA(50));
  cache.set("EMA_9", calcEMA(9));
  cache.set("EMA_20", calcEMA(20));
  cache.set("EMA_21", calcEMA(21));
  cache.set("EMA_50", calcEMA(50));

  const supertrendDir = new Array(n).fill(0);
  for (let i = 14; i < n; i++) {
    supertrendDir[i] = closes[i] > closes[i - 1] ? 1 : -1;
  }
  cache.set("SUPERTREND_DIR", supertrendDir);

  return cache;
}

export function evaluateWithRules(strategy: Strategy, candles: CandleData[], userId: string): Signal | null {
  if (candles.length < 5) return null;

  const instrumentToken = candles[0]?.instrument_token;
  const instrumentCandles = candles
    .filter(c => c.instrument_token === instrumentToken)
    .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime());

  if (instrumentCandles.length < 5) return null;

  const latestIdx = instrumentCandles.length - 1;
  const latest = instrumentCandles[latestIdx];

  if (strategy.executable_strategy) {
    const exec = strategy.executable_strategy;
    const indicatorCache = calculateSimpleIndicators(instrumentCandles);
    
    // SIGNAL MEMORY WINDOW LOGIC
    const setupKey = getSetupKey(userId, strategy.id, instrumentToken);
    let state = signalMemoryState.get(setupKey);
    
    if (!state) {
      state = {
        memory: [],
        setup: {
          state: "IDLE",
          direction: null,
          intentSignal: null,
          confirmations: [],
          setupCandleIndex: -1,
          reason: "Initialized"
        }
      };
      signalMemoryState.set(setupKey, state);
    }

    // Clean expired signals
    state.memory = state.memory.filter(s => s.expiresAt >= latestIdx);
    if (state.setup.intentSignal && state.setup.intentSignal.expiresAt < latestIdx) {
      state.setup.state = "INVALIDATED";
      state.setup.reason = "Setup expired";
    }

    const buyRules = exec.buy?.rules || [];
    const sellRules = exec.sell?.rules || [];

    // Evaluate Buy Rules
    for (let i = 0; i < buyRules.length; i++) {
      const rule = buyRules[i];
      const passed = evaluateExecutableRule(rule, instrumentCandles, latestIdx, indicatorCache);
      const role = classifyRuleRole(rule, i, buyRules.length);

      if (passed) {
        const signal: SignalMemory = {
          role,
          ruleName: getRuleName(rule),
          triggeredAt: latestIdx,
          expiresAt: latestIdx + SIGNAL_WINDOW,
          value: latest.close,
          direction: "LONG"
        };
        
        // Add to memory
        const existingIdx = state.memory.findIndex(s => s.role === role && s.ruleName === signal.ruleName && s.direction === "LONG");
        if (existingIdx >= 0) state.memory[existingIdx] = signal;
        else state.memory.push(signal);

        if (role === "INTENT" && state.setup.state === "IDLE") {
          state.setup = {
            state: "SETUP_DETECTED",
            direction: "LONG",
            intentSignal: signal,
            confirmations: [],
            setupCandleIndex: latestIdx,
            reason: `LONG setup: ${signal.ruleName} triggered`
          };
        } else if (role === "CONFIRMATION" && state.setup.state === "SETUP_DETECTED" && state.setup.direction === "LONG") {
          state.setup.confirmations.push(signal);
        }
      }
    }

    // Evaluate Sell Rules
    for (let i = 0; i < sellRules.length; i++) {
      const rule = sellRules[i];
      const passed = evaluateExecutableRule(rule, instrumentCandles, latestIdx, indicatorCache);
      const role = classifyRuleRole(rule, i, sellRules.length);

      if (passed) {
        const signal: SignalMemory = {
          role,
          ruleName: getRuleName(rule),
          triggeredAt: latestIdx,
          expiresAt: latestIdx + SIGNAL_WINDOW,
          value: latest.close,
          direction: "SHORT"
        };
        
        const existingIdx = state.memory.findIndex(s => s.role === role && s.ruleName === signal.ruleName && s.direction === "SHORT");
        if (existingIdx >= 0) state.memory[existingIdx] = signal;
        else state.memory.push(signal);

        if (role === "INTENT" && state.setup.state === "IDLE") {
          state.setup = {
            state: "SETUP_DETECTED",
            direction: "SHORT",
            intentSignal: signal,
            confirmations: [],
            setupCandleIndex: latestIdx,
            reason: `SHORT setup: ${signal.ruleName} triggered`
          };
        } else if (role === "CONFIRMATION" && state.setup.state === "SETUP_DETECTED" && state.setup.direction === "SHORT") {
          state.setup.confirmations.push(signal);
        }
      }
    }

    // Determine Final Signal
    const intentSignals = state.memory.filter(s => s.role === "INTENT");
    const confirmSignals = state.memory.filter(s => s.role === "CONFIRMATION");

    const longIntent = intentSignals.find(s => s.direction === "LONG");
    const longConfirm = confirmSignals.find(s => s.direction === "LONG");
    const shortIntent = intentSignals.find(s => s.direction === "SHORT");
    const shortConfirm = confirmSignals.find(s => s.direction === "SHORT");

    let finalAction: "BUY" | "SELL" | null = null;
    let reasoning = "";

    if (exec.buy.logic === "AND") {
      if (longIntent && longConfirm) {
        finalAction = "BUY";
        reasoning = `LONG: Intent (${longIntent.ruleName}) + Confirmation (${longConfirm.ruleName})`;
      }
    } else if (longIntent || longConfirm) {
      finalAction = "BUY";
      reasoning = longIntent ? `LONG Intent: ${longIntent.ruleName}` : `LONG Confirm: ${longConfirm!.ruleName}`;
    }

    if (!finalAction) {
      if (exec.sell.logic === "AND") {
        if (shortIntent && shortConfirm) {
          finalAction = "SELL";
          reasoning = `SHORT: Intent (${shortIntent.ruleName}) + Confirmation (${shortConfirm.ruleName})`;
        }
      } else if (shortIntent || shortConfirm) {
        finalAction = "SELL";
        reasoning = shortIntent ? `SHORT Intent: ${shortIntent.ruleName}` : `SHORT Confirm: ${shortConfirm!.ruleName}`;
      }
    }

    if (finalAction) {
      state.setup.state = "CONFIRMED";
      const sl = (finalAction === "BUY" ? exec.buyExit?.stopLoss?.value : exec.sellExit?.stopLoss?.value) || 2;
      const tgt = (finalAction === "BUY" ? exec.buyExit?.target?.value : exec.sellExit?.target?.value) || 4;
      
      const sig: Signal = {
        action: finalAction,
        instrument: `TOKEN_${latest.instrument_token}`,
        instrumentToken: latest.instrument_token,
        price: latest.close,
        stopLoss: latest.close * (finalAction === "BUY" ? (1 - sl / 100) : (1 + sl / 100)),
        target: latest.close * (finalAction === "BUY" ? (1 + tgt / 100) : (1 - tgt / 100)),
        confidence: 90,
        reasoning: reasoning
      };
      
      // Reset state after confirmed signal to avoid duplicate entries
      state.setup.state = "IDLE";
      state.memory = [];
      
      return sig;
    }

    return null;
  }

  const prev = instrumentCandles[instrumentCandles.length - 2];
  const change = (latest.close - prev.close) / prev.close;
  
  const checkBuy = () => {
    const logic = strategy.buy_entry_logic?.conditions || [];
    if (logic.length === 0) return false;
    if (JSON.stringify(logic).toLowerCase().includes("bullish") && latest.close > latest.open) return true;
    if (JSON.stringify(logic).toLowerCase().includes("price >") && latest.close > prev.close) return true;
    return false;
  };

  const checkSell = () => {
    const logic = strategy.sell_entry_logic?.conditions || [];
    if (logic.length === 0) return false;
    if (JSON.stringify(logic).toLowerCase().includes("bearish") && latest.close < latest.open) return true;
    if (JSON.stringify(logic).toLowerCase().includes("price <") && latest.close < prev.close) return true;
    return false;
  };

  if (checkBuy()) {
     return {
        action: "BUY",
        instrument: `TOKEN_${latest.instrument_token}`,
        instrumentToken: latest.instrument_token,
        price: latest.close,
        stopLoss: latest.close * 0.98,
        target: latest.close * 1.04,
        confidence: 75,
        reasoning: "Legacy rule-based signal detected",
     };
  }

  if (checkSell()) {
     return {
        action: "SELL",
        instrument: `TOKEN_${latest.instrument_token}`,
        instrumentToken: latest.instrument_token,
        price: latest.close,
        stopLoss: latest.close * 1.02,
        target: latest.close * 0.96,
        confidence: 75,
        reasoning: "Legacy rule-based signal detected",
     };
  }

  return null;
}

export async function checkKillSwitches(
  userId: string,
  userConfig: { max_daily_loss: number; max_trades_per_day: number }
): Promise<{ triggered: boolean; reason?: string }> {
  const { data: flags } = await supabase
    .from("system_flags")
    .select("flag_name, flag_value")
    .in("flag_name", ["DISABLE_TRADING", "SAFE_MODE", "MAINTENANCE_MODE"]);

  for (const flag of flags || []) {
    if (flag.flag_value === true || flag.flag_value === "true") {
      return { triggered: true, reason: `System flag: ${flag.flag_name}` };
    }
  }
  return { triggered: false };
}
