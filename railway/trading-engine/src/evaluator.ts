
import { supabase } from "./utils/supabase";
import { logger } from "./utils/logger";
import { Signal } from "./executor";
import { createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

const MIN_CANDLES_FOR_EVALUATION = 20;
const RECOMMENDED_CANDLES = 50;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
  return Buffer.from(key, "hex");
}

function decrypt(ciphertext: string): string {
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
}

interface ExecutableStrategy {
  name: string;
  description: string;
  version: number;
  buy: { logic: "AND" | "OR"; rules: any[] };
  sell: { logic: "AND" | "OR"; rules: any[] };
  hold?: { logic: "AND" | "OR"; rules: any[] };
  buyExit: { stopLoss: { type: string; value: number }; target: { type: string; value: number } };
  sellExit: { stopLoss: { type: string; value: number }; target: { type: string; value: number } };
  requiredIndicators: Array<{ name: string; period?: number }>;
  minWarmupCandles: number;
}

interface Strategy {
  id: string;
  name: string;
  buy_entry_logic: any;
  sell_entry_logic: any;
  hold_logic: any;
  instruments: number[];
  timeframe: string;
  executable_strategy?: ExecutableStrategy;
}

interface CandleData {
  instrument_token: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bucket_start: string;
}

interface AIConfig {
  provider: string;
  model: string;
  api_key: string;
}

export async function getStrategy(strategyId: string): Promise<Strategy | null> {
  const { data } = await supabase
    .from("strategies")
    .select("*")
    .eq("id", strategyId)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    buy_entry_logic: data.buy_entry_logic || {},
    sell_entry_logic: data.sell_entry_logic || {},
    hold_logic: data.hold_logic || {},
    instruments: data.selected_instruments || [],
    timeframe: data.selected_timeframes?.[0] || "5m",
    executable_strategy: data.executable_strategy || undefined,
  };
}

export async function getLatestCandles(
  instruments: number[],
  timeframe: string
): Promise<CandleData[]> {
  const tfMap: Record<string, string> = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
  };
  
  const tf = tfMap[timeframe] || "5m";
  const allCandles: CandleData[] = [];
  
  for (const instrumentToken of instruments) {
    const { data, error } = await supabase
      .from("live_candles")
      .select("instrument_token, open, high, low, close, volume, timestamp")
      .eq("instrument_token", instrumentToken)
      .eq("timeframe", tf)
      .order("timestamp", { ascending: false })
      .limit(RECOMMENDED_CANDLES);
    
    if (error) {
      logger.error(`Failed to fetch candles for ${instrumentToken}:`, error.message);
      continue;
    }
    
    if (data && data.length > 0) {
      const instrumentCandles = data.map(d => ({
        instrument_token: d.instrument_token,
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close),
        volume: parseInt(d.volume) || 0,
        bucket_start: d.timestamp,
      }));
      
      allCandles.push(...instrumentCandles);
    }
  }

  return allCandles;
}

export function hasSufficientData(candles: CandleData[], instrumentToken: number): boolean {
  const instrumentCandles = candles.filter(c => c.instrument_token === instrumentToken);
  return instrumentCandles.length >= MIN_CANDLES_FOR_EVALUATION;
}

async function getActiveAIConfig(): Promise<AIConfig | null> {
  const { data } = await supabase
    .from("admin_ai_configs")
    .select("provider, model, api_key")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("priority", { ascending: true })
    .limit(1)
    .single();

  if (!data) return null;

  return {
    provider: data.provider,
    model: data.model,
    api_key: decrypt(data.api_key),
  };
}

async function callAI(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>
): Promise<string | null> {
  try {
    let response: Response;
    switch (config.provider) {
      case "openai":
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.api_key}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            max_tokens: 500,
            temperature: 0.1,
          }),
        });
        break;
      default:
        return null;
    }

    if (!response.ok) return null;
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

export async function evaluateWithAI(
  strategy: Strategy,
  candles: CandleData[],
  userConfig: { risk_per_trade: number; max_daily_loss: number }
): Promise<Signal | null> {
  const instrumentToken = candles.length > 0 ? candles[0].instrument_token : null;
  if (!instrumentToken) return null;

  const ruleResult = evaluateWithRules(strategy, candles);
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

export function evaluateWithRules(strategy: Strategy, candles: CandleData[]): Signal | null {
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
    
    const evaluateRuleSet = (ruleSet: { logic: "AND" | "OR"; rules: any[] }): boolean => {
      if (!ruleSet?.rules || ruleSet.rules.length === 0) return false;
      const results = ruleSet.rules.map(rule => evaluateExecutableRule(rule, instrumentCandles, latestIdx, indicatorCache));
      return ruleSet.logic === "AND" ? results.every(r => r) : results.some(r => r);
    };

    const buySignal = evaluateRuleSet(exec.buy);
    const sellSignal = evaluateRuleSet(exec.sell);

    if (buySignal && !sellSignal) {
      const sl = exec.buyExit?.stopLoss?.value || 2;
      const tgt = exec.buyExit?.target?.value || 4;
      return {
        action: "BUY",
        instrument: `TOKEN_${latest.instrument_token}`,
        instrumentToken: latest.instrument_token,
        price: latest.close,
        stopLoss: latest.close * (1 - sl / 100),
        target: latest.close * (1 + tgt / 100),
        confidence: 85,
        reasoning: "Executable strategy BUY rules passed",
      };
    }

    if (sellSignal && !buySignal) {
      const sl = exec.sellExit?.stopLoss?.value || 2;
      const tgt = exec.sellExit?.target?.value || 4;
      return {
        action: "SELL",
        instrument: `TOKEN_${latest.instrument_token}`,
        instrumentToken: latest.instrument_token,
        price: latest.close,
        stopLoss: latest.close * (1 + sl / 100),
        target: latest.close * (1 - tgt / 100),
        confidence: 85,
        reasoning: "Executable strategy SELL rules passed",
      };
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
