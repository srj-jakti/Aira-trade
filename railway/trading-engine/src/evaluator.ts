import { supabase } from "./utils/supabase";
import { logger } from "./utils/logger";
import { Signal } from "./executor";
import { createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

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
  rules: unknown;
  indicators: unknown;
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
    .eq("is_active", true)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    rules: data.rules || {},
    indicators: data.indicators || {},
    instruments: data.instruments || [],
    timeframe: data.timeframe || "5s",
  };
}

export async function getLatestCandles(
  instruments: number[],
  timeframe: string
): Promise<CandleData[]> {
  const staleThreshold = new Date(Date.now() - 60000).toISOString();
  
  const tf = timeframe === "1s" ? "1s" : timeframe === "15s" ? "15s" : "5s";

  const { data } = await supabase
    .from("live_candles")
    .select("instrument_token, open, high, low, close, volume, timestamp")
    .in("instrument_token", instruments)
    .eq("timeframe", tf)
    .gte("timestamp", staleThreshold)
    .order("timestamp", { ascending: false });

  return (data || []).map(d => ({
    instrument_token: d.instrument_token,
    open: parseFloat(d.open),
    high: parseFloat(d.high),
    low: parseFloat(d.low),
    close: parseFloat(d.close),
    volume: parseInt(d.volume) || 0,
    bucket_start: d.timestamp,
  }));
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
            temperature: 0.3,
          }),
        });
        break;

      case "anthropic":
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.api_key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 500,
            messages,
          }),
        });
        break;

      case "groq":
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.api_key}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            max_tokens: 500,
          }),
        });
        break;

      default:
        logger.error(`Unknown AI provider: ${config.provider}`);
        return null;
    }

    if (!response.ok) {
      const error = await response.json();
      logger.error("AI API error", error);
      return null;
    }

    const data = await response.json() as { content?: Array<{ text?: string }>; choices?: Array<{ message?: { content?: string } }> };

    if (config.provider === "anthropic") {
      return data.content?.[0]?.text || null;
    }
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    logger.error("AI call failed", error);
    return null;
  }
}

export async function evaluateWithAI(
  strategy: Strategy,
  candles: CandleData[],
  userConfig: { risk_per_trade: number; max_daily_loss: number }
): Promise<Signal | null> {
  const aiConfig = await getActiveAIConfig();
  if (!aiConfig) {
    logger.warn("No active AI config found");
    return evaluateWithRules(strategy, candles);
  }

  const recentCandles = candles.slice(0, 30);
  if (recentCandles.length === 0) {
    logger.warn("No candle data available");
    return null;
  }

  const candlesSummary = recentCandles.map((c) => ({
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    v: c.volume,
  }));

  const messages = [
    {
      role: "system",
      content: `You are a trading signal generator. Analyze price data and provide trading signals.
Respond ONLY with valid JSON in this exact format:
{"signal":"BUY"|"SELL"|"HOLD","confidence":0-100,"entry":number,"target":number,"stopLoss":number,"reasoning":"brief"}
Do not include any other text.`,
    },
    {
      role: "user",
      content: `Analyze this price data and generate a trading signal. Risk per trade: ${userConfig.risk_per_trade}%, Max daily loss: ${userConfig.max_daily_loss}%.
Recent candles (O/H/L/C/V): ${JSON.stringify(candlesSummary)}
Strategy: ${JSON.stringify(strategy.rules)}`,
    },
  ];

  const result = await callAI(aiConfig, messages);
  if (!result) {
    return evaluateWithRules(strategy, candles);
  }

  try {
    const parsed = JSON.parse(result);
    
    if (parsed.signal === "HOLD" || !parsed.signal) {
      return null;
    }

    const lastCandle = recentCandles[0];
    
    return {
      action: parsed.signal as "BUY" | "SELL",
      instrument: `TOKEN_${lastCandle.instrument_token}`,
      instrumentToken: lastCandle.instrument_token,
      price: parsed.entry || lastCandle.close,
      stopLoss: parsed.stopLoss || lastCandle.close * (parsed.signal === "BUY" ? 0.99 : 1.01),
      target: parsed.target || lastCandle.close * (parsed.signal === "BUY" ? 1.02 : 0.98),
      confidence: parsed.confidence || 50,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    logger.error("Failed to parse AI response", { result, error });
    return evaluateWithRules(strategy, candles);
  }
}

function evaluateWithRules(strategy: Strategy, candles: CandleData[]): Signal | null {
  if (candles.length < 2) return null;

  const latest = candles[0];
  const previous = candles[1];

  if (!latest || !previous) return null;

  const change = (latest.close - previous.close) / previous.close;

  if (Math.abs(change) < 0.01) {
    return null;
  }

  const action: "BUY" | "SELL" = change > 0 ? "BUY" : "SELL";
  const multiplier = action === "BUY" ? 1 : -1;

  return {
    action,
    instrument: `TOKEN_${latest.instrument_token}`,
    instrumentToken: latest.instrument_token,
    price: latest.close,
    stopLoss: latest.close * (1 - 0.01 * multiplier),
    target: latest.close * (1 + 0.02 * multiplier),
    confidence: Math.min(100, Math.abs(change) * 1000),
    reasoning: `Price ${change > 0 ? "increased" : "decreased"} by ${(Math.abs(change) * 100).toFixed(2)}%`,
  };
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

  const today = new Date().toISOString().split("T")[0];
  const { data: todaysOrders } = await supabase
    .from("user_orders")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", today);

  if ((todaysOrders?.length || 0) >= userConfig.max_trades_per_day) {
    return { triggered: true, reason: "Max daily trades reached" };
  }

  const { data: signals } = await supabase
    .from("ai_signals")
    .select("pnl")
    .eq("user_id", userId)
    .gte("created_at", today);

  const dailyPnl = (signals || []).reduce((sum, s) => sum + (s.pnl || 0), 0);
  
  if (dailyPnl <= -userConfig.max_daily_loss) {
    return { triggered: true, reason: "Daily loss limit reached" };
  }

  return { triggered: false };
}
