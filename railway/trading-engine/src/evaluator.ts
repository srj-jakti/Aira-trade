
import { supabase } from "./utils/supabase";
import { logger } from "./utils/logger";
import { Signal } from "./executor";
import { createDecipheriv } from "crypto";
import { processZairothSafe, evaluateSafety } from "../../../src/lib/zairoth";
import { redis, REDIS_KEYS } from "./utils/redis";
import { getRLScoreForInstrument, extractPatternType } from "./rl-scorer";
import { MarketContextEngine, MarketContext } from "./market-context";
import { TradeFilter } from "./trade-filter";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
  return Buffer.from(key, "hex");
}

function decrypt(ciphertext: string): string {
  try {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error("Invalid encrypted format");
    }
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    logger.error("Decryption failed", err);
    return ciphertext; // Fallback to raw if not encrypted (risk)
  }
}

async function getActiveAIConfig() {
  const { data, error } = await supabase
    .from("admin_ai_configs")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return {
    ...data,
    api_key: decrypt(data.api_key)
  };
}

async function callAI(config: any, messages: any[]) {
  try {
    let url = "";
    let body = {};
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.provider === "openai") {
      url = "https://api.openai.com/v1/chat/completions";
      headers["Authorization"] = `Bearer ${config.api_key}`;
      body = {
        model: config.model || "gpt-4o",
        messages,
        response_format: { type: "json_object" },
      };
    } else if (config.provider === "anthropic") {
      url = "https://api.anthropic.com/v1/messages";
      headers["x-api-key"] = config.api_key;
      headers["anthropic-version"] = "2023-06-01";
      body = {
        model: config.model || "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
        messages: messages.map(m => m.role === "system" ? { role: "user", content: `System Instruction: ${m.content}` } : m),
      };
    } else if (config.provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      headers["Authorization"] = `Bearer ${config.api_key}`;
      body = {
        model: config.model || "llama-3.1-70b-versatile",
        messages,
        response_format: { type: "json_object" },
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data: any = await response.json();
    if (config.provider === "anthropic") {
      return data.content?.[0]?.text || null;
    }
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    logger.error(`AI call failed (${config.provider}):`, err);
    return null;
  }
}

/**
 * EXPERT VALIDATION: Discretionary logic to filter "bad" signals
 * Mimics how a human trader looks at a setup.
 */
function validateExpertEntry(candles: CandleData[], action: "BUY" | "SELL"): { ok: boolean; reason?: string } {
  if (candles.length < 5) return { ok: true };
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  // 1. Candle Quality Check: Avoid tiny "Doji" entries or massive exhaustion candles
  const bodySize = Math.abs(last.close - last.open);
  const range = last.high - last.low;
  const avgRange = candles.slice(-10).reduce((acc, c) => acc + (c.high - c.low), 0) / 10;
  
  if (bodySize < range * 0.1) return { ok: false, reason: "Doji/Indecision candle at entry" };
  if (range > avgRange * 3) return { ok: false, reason: "Exhaustion candle detected" };

  // 2. Volume Check: Institutional moves need volume
  const avgVolume = candles.slice(-10).reduce((acc, c) => acc + c.volume, 0) / 10;
  if (last.volume < avgVolume * 0.5) return { ok: false, reason: "Low volume conviction" };

  // 3. Mean Reversion Risk: Don't buy if price is too far from EMA
  const ema20 = last.indicators?.EMA_20 || last.indicators?.EMA_21;
  if (ema20) {
    const dist = ((last.close - ema20) / ema20) * 100;
    if (action === "BUY" && dist > 2) return { ok: false, reason: "Price overextended from EMA20 (Long)" };
    if (action === "SELL" && dist < -2) return { ok: false, reason: "Price overextended from EMA20 (Short)" };
  }

  return { ok: true };
}

export interface CandleData {
  instrument_token: number;
  timeframe: string;
  bucket_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
  indicators?: any;
}

export interface Strategy {
  id: string;
  name: string;
  timeframe: string;
  instruments: number[];
  zairoth_intent?: string;
  buy_entry_logic?: any;
  sell_entry_logic?: any;
  executable_strategy?: any;
  buyExit?: any;
  sellExit?: any;
}

const MIN_CANDLES_FOR_EVALUATION = 20;
const RECOMMENDED_CANDLES = 50;

/**
 * Fetches the latest candles for given instruments and timeframe.
 * Prioritizes Redis for low latency, falls back to Supabase.
 */
export async function getLatestCandles(instrumentTokens: number[], timeframe: string): Promise<CandleData[]> {
  const allCandles: CandleData[] = [];

  for (const token of instrumentTokens) {
    try {
      // 1. Try Redis List (last 100 candles)
      const listKey = REDIS_KEYS.CANDLE_LIST(token, timeframe);
      const cachedCandles = await redis.lrange(listKey, 0, -1);

      if (cachedCandles && cachedCandles.length > 0) {
        const parsed = cachedCandles.map(c => {
          const data = JSON.parse(c);
          return {
            instrument_token: data.token,
            timeframe: data.timeframe,
            bucket_start: new Date(data.bucketStart).toISOString(),
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume || 0,
            oi: data.oi || 0,
            indicators: data.indicators
          } as CandleData;
        });
        
        // Add live candle (if exists and newer than last closed candle)
        const liveKey = REDIS_KEYS.LIVE_CANDLE(token, timeframe);
        const liveCandleRaw = await redis.get(liveKey);
        if (liveCandleRaw) {
          const data = JSON.parse(liveCandleRaw);
          const liveCandle = {
            instrument_token: data.token,
            timeframe: data.timeframe,
            bucket_start: new Date(data.bucketStart).toISOString(),
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume || 0,
            oi: data.oi || 0,
            indicators: data.indicators
          } as CandleData;

          if (parsed.length === 0 || liveCandle.bucket_start > parsed[parsed.length - 1].bucket_start) {
            parsed.push(liveCandle);
          }
        }

        allCandles.push(...parsed);
        continue;
      }

      // 2. Fallback to Supabase
      const { data: dbCandles, error } = await supabase
        .from("live_candles")
        .select("*")
        .eq("instrument_token", token)
        .eq("timeframe", timeframe)
        .order("timestamp", { ascending: false })
        .limit(RECOMMENDED_CANDLES);

      if (dbCandles && !error) {
        const formatted = dbCandles.map(c => ({
          instrument_token: c.instrument_token,
          timeframe: c.timeframe,
          bucket_start: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          oi: c.oi,
          indicators: c.indicators
        })).reverse();
        allCandles.push(...formatted);
      }
    } catch (err) {
      logger.error(`Error fetching candles for ${token}:`, err);
    }
  }

  return allCandles;
}

export async function getStrategy(strategyId: string): Promise<Strategy | null> {
  const { data, error } = await supabase
    .from("strategies")
    .select("*")
    .eq("id", strategyId)
    .single();

  if (error || !data) return null;
  return data as Strategy;
}

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
  context?: MarketContext;
}

// In-memory persistent state for Signal Memory
const SIGNAL_WINDOW = 5;

async function loadSignalMemory(userId: string, strategyId: string, instrumentToken: number): Promise<{ memory: SignalMemory[], setup: TradeSetup } | null> {
  const { data, error } = await supabase
    .from("railway_signal_memory")
    .select("state")
    .eq("user_id", userId)
    .eq("strategy_id", strategyId)
    .eq("instrument_token", instrumentToken)
    .single();

  if (error || !data) return null;
  return data.state as { memory: SignalMemory[], setup: TradeSetup };
}

async function saveSignalMemory(userId: string, strategyId: string, instrumentToken: number, state: { memory: SignalMemory[], setup: TradeSetup }): Promise<void> {
  await supabase
    .from("railway_signal_memory")
    .upsert({
      user_id: userId,
      strategy_id: strategyId,
      instrument_token: instrumentToken,
      state,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,strategy_id,instrument_token" });
}

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

const RL_ENGINE_URL = process.env.RL_ENGINE_URL || "http://rl-engine:8000";

async function getRLPrediction(instrumentToken: number, timeframe: string, candles: CandleData[]) {
  try {
    const response = await fetch(`${RL_ENGINE_URL}/predict/direction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instrument_token: instrumentToken,
        timeframe,
        data: candles
      }),
    });
    return await response.json();
  } catch (err) {
    logger.error("Failed to fetch RL direction prediction:", err);
    return null;
  }
}

async function getRLForecast(instrumentToken: number, timeframe: string, candles: CandleData[]) {
  try {
    const response = await fetch(`${RL_ENGINE_URL}/predict/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instrument_token: instrumentToken,
        timeframe,
        data: candles
      }),
    });
    return await response.json();
  } catch (err) {
    logger.error("Failed to fetch RL price forecast:", err);
    return null;
  }
}

export async function evaluateWithAI(
  strategy: Strategy,
  candles: CandleData[],
  userConfig: { risk_per_trade: number; max_daily_loss: number; user_id: string; capital_used?: number }
): Promise<Signal | null> {
  const instrumentToken = candles.length > 0 ? candles[0].instrument_token : null;
  if (!instrumentToken) return null;

  const instrumentCandles = candles
    .filter(c => c.instrument_token === instrumentToken)
    .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime());
  
  // 1. ANALYZE MARKET CONTEXT
  const context = MarketContextEngine.analyze(instrumentCandles);
  logger.info(`[CONTEXT] ${instrumentToken}: Regime=${context.regime}, Volatility=${context.volatility}, Structure=${context.marketStructure}`);

  // 2. RL KNOWLEDGE ENGINE & ADVANCED PREDICTIONS
  const patternType = extractPatternType(strategy.zairoth_intent || strategy.name || "");
  const rlScore = await getRLScoreForInstrument(
    instrumentToken,
    patternType,
    strategy.timeframe,
    { trend: context.regime.includes("UP") ? "UPTREND" : context.regime.includes("DOWN") ? "DOWNTREND" : "SIDEWAYS", volatility: context.volatility }
  );

  // New: Advanced RL Predictions (XGBoost + Darts)
  const [rlPrediction, rlForecast] = await Promise.all([
    getRLPrediction(instrumentToken, strategy.timeframe, instrumentCandles.slice(-100)),
    getRLForecast(instrumentToken, strategy.timeframe, instrumentCandles.slice(-100))
  ]);

  // AI Gating logic
  if (rlScore.recommendation === "STRONG_AVOID") {
    logger.warn(`[RL] Blocking trade for ${instrumentToken}: ${rlScore.reasoning}`);
    return null;
  }

  // XGBoost Gating: Check confidence and direction alignment
  if (rlPrediction && rlPrediction.confidence < 0.6) {
    logger.warn(`[RL-XGBOOST] Gating trade for ${instrumentToken}: Low confidence (${rlPrediction.confidence})`);
    return null;
  }

  // 3. ZAIROTH SAFETY CHECK
    if (strategy.zairoth_intent) {
      const zairoth = processZairothSafe(strategy.zairoth_intent);
      if (zairoth.success) {
        const safety: any = evaluateSafety((zairoth.result as any).instructions, { 
          capital_used: userConfig.capital_used || 0,
          risk_per_trade: userConfig.risk_per_trade 
        });
        if (!safety.safe) {
        logger.warn(`[ZAIROTH] Safety check failed for ${strategy.name}: ${safety.reason}`);
        return null;
      }
    }
  }

  // 4. RULE-BASED EVALUATION (with context awareness)
  const ruleResult = await evaluateWithRules(strategy, candles, userConfig.user_id, context);
  
    if (ruleResult) {
      // RL Gating for Rule-Based Signal
      if (rlPrediction) {
        if (ruleResult.action === "BUY" && rlPrediction.prediction === "DOWN") {
          logger.warn(`[RL-XGBOOST] Gating LONG trade: AI predicts DOWN`);
          return null;
        }
        if (ruleResult.action === "SELL" && rlPrediction.prediction === "UP") {
          logger.warn(`[RL-XGBOOST] Gating SHORT trade: AI predicts UP`);
          return null;
        }
      }

      const filter = TradeFilter.evaluate(ruleResult, context, rlScore);
      if (filter.allow) {
        ruleResult.confidence = filter.adjustedConfidence;
        ruleResult.reasoning += ` [Filter: ${filter.reason}]`;
        
        // Darts Forecast: Dynamic SL/TP adjustment
        if (rlForecast) {
          if (ruleResult.action === "BUY" && rlForecast.target_high > ruleResult.target) {
            ruleResult.target = rlForecast.target_high;
            ruleResult.reasoning += " [TP Optimized by Darts]";
          }
        }
        
        return ruleResult;
      }
      logger.info(`[FILTER] Rule-based signal rejected: ${filter.reason}`);
    }


  // 5. SEMANTIC AI EVALUATION (The "Human Eye")
  const aiConfig = await getActiveAIConfig();
  if (!aiConfig) return null;

  const recentCandles = instrumentCandles.slice(-25);
  const messages = [
    {
      role: "system",
      content: `ROLE: Institutional Systematic Trader.
OBJECTIVE: Identify high-probability institutional setups.

MARKET CONTEXT:
- Regime: ${context.regime}
- Trend Strength: ${context.trendStrength}/100
- Volatility: ${context.volatility}
- Structure: ${context.marketStructure}
- RSI: ${context.rsi.toFixed(2)}
- EMA Distance: ${context.distanceFromEMA.toFixed(2)}%

INSTITUTIONAL CRITERIA:
1. Don't buy into resistance or sell into support.
2. Avoid chasing vertical moves (high EMA distance).
3. Look for "stop hunts" or liquidity sweeps.
4. Trend alignment: Only trade in the direction of ${context.regime} unless it's a clear exhaustion reversal.

Respond ONLY with JSON:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": 0-100,
  "tp_sl_ratio": number,
  "reasoning": "Technical justification based on context"
}`,
    },
    {
      role: "user",
      content: `Analyze setup for ${strategy.name}. 
Intent: ${strategy.zairoth_intent || "N/A"}
Candles: ${JSON.stringify(recentCandles.map(c => ({
  t: c.bucket_start,
  o: c.open,
  h: c.high,
  l: c.low,
  c: c.close,
  v: c.volume,
  rsi: c.indicators?.RSI_14,
  ema: c.indicators?.EMA_20
})))}`,
    },
  ];

  const result = await callAI(aiConfig, messages);
  if (!result) return null;

  try {
    const parsed = JSON.parse(result);
    if (parsed.signal === "HOLD") return null;

    const tempSignal: Signal = {
      action: parsed.signal as "BUY" | "SELL",
      instrument: `TOKEN_${instrumentToken}`,
      instrumentToken: instrumentToken,
      price: instrumentCandles[instrumentCandles.length - 1].close,
      stopLoss: 0, // Calculated below
      target: 0, // Calculated below
      confidence: parsed.confidence,
      reasoning: parsed.reasoning
    };

      const filter = TradeFilter.evaluate(tempSignal, context, rlScore);
      if (!filter.allow) {
        logger.info(`[FILTER] AI Signal rejected: ${filter.reason}`);
        return null;
      }

      // RL Gating for Semantic AI Signal
      if (rlPrediction) {
        if (tempSignal.action === "BUY" && rlPrediction.prediction === "DOWN") {
          logger.warn(`[RL-XGBOOST] Gating Semantic LONG trade: AI predicts DOWN`);
          return null;
        }
        if (tempSignal.action === "SELL" && rlPrediction.prediction === "UP") {
          logger.warn(`[RL-XGBOOST] Gating Semantic SHORT trade: AI predicts UP`);
          return null;
        }
      }

      // Expert Heuristics Check

    const expertCheck = validateExpertEntry(instrumentCandles, parsed.signal);
    if (!expertCheck.ok) {
      logger.info(`[EXPERT] AI Signal rejected: ${expertCheck.reason}`);
      return null;
    }

    const last = instrumentCandles[instrumentCandles.length - 1];
    return {
      action: parsed.signal as "BUY" | "SELL",
      instrument: `TOKEN_${last.instrument_token}`,
      instrumentToken: last.instrument_token,
      price: last.close,
      stopLoss: last.close * (parsed.signal === "BUY" ? 0.99 : 1.01),
      target: last.close * (parsed.signal === "BUY" ? 1.03 : 0.97),
      confidence: filter.adjustedConfidence,
      reasoning: `[SEMANTIC AI] ${parsed.reasoning} [Filter: ${filter.reason}]`,
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

export async function evaluateWithRules(
  strategy: Strategy,
  candles: CandleData[],
  userId: string,
  context?: MarketContext
): Promise<Signal | null> {
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
    
    // SIGNAL MEMORY WINDOW LOGIC - Persistent via Supabase
    let state = await loadSignalMemory(userId, strategy.id, instrumentToken);
    
    if (!state) {
      state = {
        memory: [],
        setup: {
          state: "IDLE",
          direction: null,
          intentSignal: null,
          confirmations: [],
          setupCandleIndex: -1,
          reason: "Initialized",
          context: context // Store context in setup
        }
      };
    } else {
      // Update context if provided
      if (context) state.setup.context = context;
    }

    // Clean expired signals
    state.memory = state.memory.filter(s => s.expiresAt >= latestIdx);
    if (state.setup.intentSignal && state.setup.intentSignal.expiresAt < latestIdx) {
      state.setup.state = "INVALIDATED";
      state.setup.reason = "Setup expired";
    }

    const buyRules = exec.buy?.rules || [];
    const sellRules = exec.sell?.rules || [];

    let hasMemoryChange = false;

    // Evaluate Buy Rules
    for (let i = 0; i < buyRules.length; i++) {
      const rule = buyRules[i];
      const passed = evaluateExecutableRule(rule, instrumentCandles, latestIdx, indicatorCache);
      const role = classifyRuleRole(rule, i, buyRules.length);

      if (passed) {
        hasMemoryChange = true;
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
        hasMemoryChange = true;
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

    // Save state back to Supabase
    if (hasMemoryChange || finalAction) {
      if (finalAction) {
        // Reset state after confirmed signal to avoid duplicate entries
        state.setup.state = "IDLE";
        state.memory = [];
      }
      await saveSignalMemory(userId, strategy.id, instrumentToken, state);
    }

      if (finalAction) {
        // Expert Heuristics Check for Rule-Based Signals
        const expertCheck = validateExpertEntry(instrumentCandles, finalAction);
        if (!expertCheck.ok) {
          logger.info(`[EXPERT] Rule-based ${finalAction} rejected: ${expertCheck.reason}`);
          return null;
        }

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

  const buyOk = checkBuy();
  const sellOk = checkSell();

  if (buyOk || sellOk) {
    const action = buyOk ? "BUY" : "SELL";
    // Expert Heuristics Check for Legacy Signals
    const expertCheck = validateExpertEntry(instrumentCandles, action);
    if (!expertCheck.ok) {
      logger.info(`[EXPERT] Legacy ${action} rejected: ${expertCheck.reason}`);
      return null;
    }

    return {
      action,
      instrument: `TOKEN_${latest.instrument_token}`,
      instrumentToken: latest.instrument_token,
      price: latest.close,
      stopLoss: latest.close * (action === "BUY" ? 0.98 : 1.02),
      target: latest.close * (action === "BUY" ? 1.04 : 0.96),
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
