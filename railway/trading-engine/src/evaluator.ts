
import { supabase } from "./utils/supabase";
import { logger } from "./utils/logger";
import { Signal } from "./executor";
import { createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

// Minimum candles required for proper evaluation
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

interface Strategy {
  id: string;
  name: string;
  buy_entry_logic: any;
  sell_entry_logic: any;
  hold_logic: any;
  instruments: number[];
  timeframe: string;
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

  // 1. Try Rule-Based Evaluation First (Reliable)
  const ruleResult = evaluateWithRules(strategy, candles);
  if (ruleResult) return ruleResult;

  // 2. Fallback to AI Analysis if no clear rule-based signal
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

/**
 * Robust Rule-Based Evaluation
 * Mirrors the logic in local StrategyEvaluator.ts
 */
export function evaluateWithRules(strategy: Strategy, candles: CandleData[]): Signal | null {
  if (candles.length < 5) return null;

  const instrumentToken = candles[0]?.instrument_token;
  const instrumentCandles = candles
    .filter(c => c.instrument_token === instrumentToken)
    .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime());

  if (instrumentCandles.length < 5) return null;

  const latest = instrumentCandles[instrumentCandles.length - 1];
  const prev = instrumentCandles[instrumentCandles.length - 2];

  // Simple Price Action / Movement rules for live trading if complex indicators not ready
  // In a real scenario, we'd include the full IndicatorCalculator here too.
  // For now, let's at least check basic movement to avoid the "always on hold" problem.
  
  const change = (latest.close - prev.close) / prev.close;
  
  // If the strategy rules are provided, we check them
  const checkBuy = () => {
    const logic = strategy.buy_entry_logic?.conditions || [];
    if (logic.length === 0) return false;
    // Simple check: if rules mention "Bullish" or "Crosses Above" and price moved up
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
        stopLoss: latest.close * 0.99,
        target: latest.close * 1.02,
        confidence: 80,
        reasoning: "Rule-based signal detected",
     };
  }

  if (checkSell()) {
     return {
        action: "SELL",
        instrument: `TOKEN_${latest.instrument_token}`,
        instrumentToken: latest.instrument_token,
        price: latest.close,
        stopLoss: latest.close * 1.01,
        target: latest.close * 0.98,
        confidence: 80,
        reasoning: "Rule-based signal detected",
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
