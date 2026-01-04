import { supabaseAdmin } from "@/lib/supabase/admin";
import { aiSharedService } from "./ai-shared-service";
import { marketDataEngine } from "./market-data-engine";
import { decrypt } from "./encryption";
import { IndicatorCalculator, type Candle as CalcCandle } from "./indicator-calculator";
import { StrategyEvaluator } from "./strategy-evaluator";
import { StrategyRuleExecutor, formatEvaluationLogForDisplay } from "./strategy-rule-executor";
import {
  type ExecutableStrategy,
  type EvaluationLog,
  validateStrategy,
  getRequiredWarmupPeriod,
} from "@/lib/types/strategy";

export interface StrategyLogic {
  conditions: string[];
  indicators?: string[];
  parameters?: Record<string, number | string>;
  description?: string;
}

export interface StructuredStrategy {
  name: string;
  description: string;
  strategy_type?: "SWING" | "INTRADAY" | "SCALPING" | "OPTIONS";
  buy_entry_logic: StrategyLogic;
  buy_stop_loss: StrategyLogic;
  buy_target: StrategyLogic;
  buy_trailing_sl: StrategyLogic;
  sell_entry_logic: StrategyLogic;
  sell_stop_loss: StrategyLogic;
  sell_target: StrategyLogic;
  sell_trailing_sl: StrategyLogic;
  hold_logic: StrategyLogic;
  executable_strategy?: ExecutableStrategy;
}

export interface BacktestResult {
  capital_used: number;
  total_trades: number;
  buy_count: number;
  sell_count: number;
  hold_count: number;
  net_pnl: number;
  net_pnl_percentage: number;
  win_rate: number;
  loss_rate: number;
  max_drawdown: number;
  max_drawdown_percentage: number;
  trade_log: TradeEntry[];
  data_source: string;
  candle_count: number;
  date_range: { from: string; to: string };
}

export interface TradeEntry {
  id: string;
  type: "BUY" | "SELL";
  entry_time: string;
  entry_price: number;
  exit_time?: string;
  exit_price?: number;
  quantity: number;
  pnl?: number;
  pnl_percentage?: number;
  exit_reason?: string;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

  const TIMEFRAME_LOOKBACK: Record<string, { days: number; label: string }> = {
    "1m": { days: 30, label: "30 Days" },
    "3m": { days: 60, label: "60 Days" },
    "5m": { days: 90, label: "3 Months" },
    "15m": { days: 90, label: "3 Months" },
    "30m": { days: 180, label: "6 Months" },
    "1h": { days: 365, label: "1 Year" },
    "day": { days: 1825, label: "5 Years" },
  };

function normalizeTimeframe(tf: string): string {
  const aliases: Record<string, string> = {
    "1d": "day",
    "day": "day",
    "D": "day",
    "1w": "week",
    "week": "week",
    "3minute": "3m",
    "5minute": "5m",
    "15minute": "15m",
    "60minute": "1h",
  };
  return aliases[tf] || tf;
}

function getZerodhaInterval(timeframe: string): string {
  const intervalMap: Record<string, string> = {
    "1m": "minute",
    "3m": "3minute",
    "5m": "5minute",
    "15m": "15minute",
    "30m": "30minute",
    "1h": "60minute",
    "day": "day",
  };
  const normalized = normalizeTimeframe(timeframe);
  return intervalMap[normalized] || "5minute";
}

class StrategyService {
  private static instance: StrategyService;

  private constructor() {}

  static getInstance(): StrategyService {
    if (!StrategyService.instance) {
      StrategyService.instance = new StrategyService();
    }
    return StrategyService.instance;
  }

    async formatStrategyWithAI(rawInput: string): Promise<StructuredStrategy> {
      const messages = [
          {
            role: "system",
            content: `You are a Senior Quant Developer creating PRACTICAL trading strategies for Indian markets (NSE).
  
  ### STRATEGY CLASSIFICATION:
  Identify the strategy type:
  - INTRADAY: Entry and Exit happen on the same day. All positions MUST exit before 3:20 PM.
  - SWING: Positions held for multiple days.
  - SCALPING: Very short term trades (minutes).
  - OPTIONS: Strategies specifically mentioning options or complex Greeks.
  
  ### CRITICAL: GENERATE SIMPLE, TRADEABLE STRATEGIES
  1. Use ONLY 1-2 rules per entry (buy/sell).
  2. For INTRADAY, add a rule to exit all positions at the end of the day.
  3. Use REALISTIC thresholds:
     - RSI oversold: 35-40, overbought: 60-65
     - Moving average crossovers work well
  
  ### AVAILABLE INDICATORS:
  - RSI, EMA, SMA, SUPERTREND, MACD, BB_UPPER, BB_LOWER, ADX
  
  ### OUTPUT JSON FORMAT:
  {
    "name": "Strategy Name",
    "description": "Brief description",
    "strategy_type": "INTRADAY" | "SWING" | "SCALPING" | "OPTIONS",
    "buy_entry_logic": { "conditions": ["Human readable condition 1"] },
    "sell_entry_logic": { "conditions": ["Human readable condition 1"] },
    "buy_stop_loss": { "parameters": { "percentage": 1.5 } },
    "buy_target": { "parameters": { "percentage": 3 } },
    "buy_trailing_sl": { "conditions": [] },
    "sell_stop_loss": { "parameters": { "percentage": 1.5 } },
    "sell_target": { "parameters": { "percentage": 3 } },
    "sell_trailing_sl": { "conditions": [] },
    "hold_logic": { "conditions": [] },
    "executable_strategy": {
      "name": "Strategy Name",
      "strategyType": "INTRADAY" | "SWING" | "SCALPING" | "OPTIONS",
      "version": 1,
      "buy": { "logic": "OR", "rules": [...] },
      "sell": { "logic": "OR", "rules": [...] },
      "buyExit": { "stopLoss": { "type": "PERCENTAGE", "value": 1.5 }, "target": { "type": "PERCENTAGE", "value": 3 } },
      "sellExit": { "stopLoss": { "type": "PERCENTAGE", "value": 1.5 }, "target": { "type": "PERCENTAGE", "value": 3 } },
      "requiredIndicators": [...],
      "minWarmupCandles": 20
    }
  }
  
  IMPORTANT: For INTRADAY strategies, ensure the description mentions "Exits same day".`,
          },
      {
        role: "user",
        content: `Convert this trading idea into a SIMPLE, PRACTICAL executable strategy with realistic thresholds:\n\n${rawInput}`,
      },
    ];

    const result = await aiSharedService.executeAnalysis("strategy_format", messages, {
      maxTokens: 3000,
      skipCache: true,
    });

      if (!result.success || !result.result) {
        throw new Error("AI failed to format strategy");
      }

          try {
            let jsonString = typeof result.result === "string" ? result.result : JSON.stringify(result.result);
            
            // More robust JSON extraction
            const firstBrace = jsonString.indexOf("{");
            const lastBrace = jsonString.lastIndexOf("}");
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            } else {
              jsonString = jsonString.replace(/```json\n?|\n?```/g, "").trim();
            }

            const parsed = JSON.parse(jsonString);

            // Ensure all required fields exist to prevent UI crashes
            const ensureFields = (obj: any) => {
              const fields = [
                "buy_entry_logic", "buy_stop_loss", "buy_target", "buy_trailing_sl",
                "sell_entry_logic", "sell_stop_loss", "sell_target", "sell_trailing_sl",
                "hold_logic"
              ];
              fields.forEach(field => {
                if (!obj[field]) obj[field] = { conditions: [] };
                if (!obj[field].conditions) obj[field].conditions = [];
              });
              if (!obj.name) obj.name = "New Strategy";
              if (!obj.description) obj.description = "Generated by AI";
              return obj;
            };

            const finalized = ensureFields(parsed);
            
            console.log("[StrategyService] AI returned executable_strategy:", !!finalized.executable_strategy);
            
            if (finalized.executable_strategy) {
              // Post-process to fix common AI mistakes
              finalized.executable_strategy = this.sanitizeExecutableStrategy(finalized.executable_strategy);
              
              const validation = validateStrategy(finalized.executable_strategy);
              if (!validation.valid) {
                console.warn("[StrategyService] Executable strategy validation failed:", validation.errors);
                finalized.executable_strategy = this.createFallbackExecutableStrategy(finalized);
              } else {
                console.log("[StrategyService] Executable strategy is valid with rules:", 
                  JSON.stringify({
                    buyRules: finalized.executable_strategy.buy?.rules?.length || 0,
                    sellRules: finalized.executable_strategy.sell?.rules?.length || 0,
                    buyLogic: finalized.executable_strategy.buy?.logic,
                    sellLogic: finalized.executable_strategy.sell?.logic,
                  })
                );
              }
            } else {
              console.log("[StrategyService] No executable_strategy returned by AI, creating fallback...");
              finalized.executable_strategy = this.createFallbackExecutableStrategy(finalized);
            }
            
            return finalized as StructuredStrategy;
        } catch (e) {
          console.error("[StrategyService] Failed to parse AI response:", e);
          throw new Error("Failed to parse AI response");
        }
      }

  private sanitizeExecutableStrategy(strategy: ExecutableStrategy): ExecutableStrategy {
    // Fix overly strict RSI thresholds
    const fixRSIThresholds = (rules: any[]) => {
      return rules.map(rule => {
        if (rule.type === "indicator" && rule.name === "RSI") {
          if (rule.operator === "<" && rule.value <= 30) {
            return { ...rule, value: 40 }; // Relax from 30 to 40
          }
          if (rule.operator === ">" && rule.value >= 70) {
            return { ...rule, value: 60 }; // Relax from 70 to 60
          }
        }
        return rule;
      });
    };

    // Remove broken indicators (Z-Score, etc)
    const removeUnsupportedRules = (rules: any[]) => {
      return rules.filter(rule => {
        if (rule.type === "indicator" && ["ZSCORE", "Z_SCORE", "Z-SCORE"].includes(rule.name?.toUpperCase())) {
          console.log("[StrategyService] Removing unsupported Z-Score rule");
          return false;
        }
        if (rule.type === "pattern" && ["BULLISH_ENGULFING", "BEARISH_ENGULFING", "HAMMER", "DOJI"].includes(rule.pattern)) {
          console.log("[StrategyService] Removing rare pattern rule:", rule.pattern);
          return false;
        }
        return true;
      });
    };

    // Process buy rules
    if (strategy.buy?.rules) {
      strategy.buy.rules = removeUnsupportedRules(fixRSIThresholds(strategy.buy.rules));
      // If only 1 rule left after filtering, use OR logic to increase signals
      if (strategy.buy.rules.length <= 2) {
        strategy.buy.logic = "OR";
      }
      // If no rules left, add a simple default
      if (strategy.buy.rules.length === 0) {
        strategy.buy.rules = [
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 40 }
        ];
        strategy.buy.logic = "OR";
      }
    }

    // Process sell rules
    if (strategy.sell?.rules) {
      strategy.sell.rules = removeUnsupportedRules(fixRSIThresholds(strategy.sell.rules));
      if (strategy.sell.rules.length <= 2) {
        strategy.sell.logic = "OR";
      }
      if (strategy.sell.rules.length === 0) {
        strategy.sell.rules = [
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 60 }
        ];
        strategy.sell.logic = "OR";
      }
    }

    // Ensure warmup is reasonable
    if (!strategy.minWarmupCandles || strategy.minWarmupCandles > 100) {
      strategy.minWarmupCandles = 20;
    }

    return strategy;
  }

  private createFallbackExecutableStrategy(strategy: StructuredStrategy): ExecutableStrategy {
    const buyRules: any[] = [];
    const sellRules: any[] = [];
    const indicators: Array<{ name: any; period?: number }> = [];

    const parseConditions = (conditions: string[], type: "buy" | "sell") => {
      const rules = type === "buy" ? buyRules : sellRules;
      
      for (const cond of conditions || []) {
        const lower = cond.toLowerCase();
        
        if (lower.includes("rsi")) {
          const match = lower.match(/rsi[^\d]*(\d+)?[^\d]*([<>=]+|below|above|crosses?\s*(?:above|below))[^\d]*(\d+)/i);
          if (match) {
            const period = parseInt(match[1]) || 14;
            const opStr = match[2].toLowerCase();
            const value = parseInt(match[3]);
            let operator = ">";
            if (opStr.includes("<") || opStr.includes("below")) operator = "<";
            if (opStr.includes("cross") && opStr.includes("above")) operator = "CROSS_ABOVE";
            if (opStr.includes("cross") && opStr.includes("below")) operator = "CROSS_BELOW";
            rules.push({ type: "indicator", name: "RSI", period, operator, value });
            if (!indicators.find(i => i.name === "RSI" && i.period === period)) {
              indicators.push({ name: "RSI", period });
            }
          }
        }
        
        if (lower.includes("supertrend")) {
          if (lower.includes("bullish") || lower.includes("buy")) {
            rules.push({ type: "trend", indicator: "SUPERTREND", direction: "BULLISH" });
          } else if (lower.includes("bearish") || lower.includes("sell")) {
            rules.push({ type: "trend", indicator: "SUPERTREND", direction: "BEARISH" });
          }
          if (!indicators.find(i => i.name === "SUPERTREND")) {
            indicators.push({ name: "SUPERTREND" as any });
          }
        }
        
        if (lower.includes("ema") || lower.includes("sma")) {
          const maType = lower.includes("ema") ? "EMA" : "SMA";
          const match = lower.match(/(ema|sma)[^\d]*\(?(\d+)\)?/i);
          const period = match ? parseInt(match[2]) : 20;
          
          if (lower.includes("price") || lower.includes("close")) {
            let operator: any = ">";
            if (lower.includes("<") || lower.includes("below")) operator = "<";
            if (lower.includes("cross") && lower.includes("above")) operator = "CROSS_ABOVE";
            if (lower.includes("cross") && lower.includes("below")) operator = "CROSS_BELOW";
            rules.push({ 
              type: "price_vs_indicator", 
              priceField: "close", 
              operator, 
              indicator: maType, 
              indicatorPeriod: period 
            });
          }
          if (!indicators.find(i => i.name === maType && i.period === period)) {
            indicators.push({ name: maType as any, period });
          }
        }
        
        if (lower.includes("macd")) {
          if (lower.includes("cross") && lower.includes("above")) {
            rules.push({ 
              type: "indicator_vs_indicator", 
              indicator1: "MACD", 
              indicator2: "MACD_SIGNAL", 
              operator: "CROSS_ABOVE" 
            });
          } else if (lower.includes("cross") && lower.includes("below")) {
            rules.push({ 
              type: "indicator_vs_indicator", 
              indicator1: "MACD", 
              indicator2: "MACD_SIGNAL", 
              operator: "CROSS_BELOW" 
            });
          } else if (lower.includes(">") || lower.includes("above")) {
            rules.push({ type: "indicator", name: "MACD_HIST", operator: ">", value: 0 });
          } else if (lower.includes("<") || lower.includes("below")) {
            rules.push({ type: "indicator", name: "MACD_HIST", operator: "<", value: 0 });
          }
          if (!indicators.find(i => i.name === "MACD")) {
            indicators.push({ name: "MACD" as any });
          }
        }
        
        if (lower.includes("bullish candle") || lower.includes("green candle")) {
          rules.push({ type: "price_action", action: "BULLISH_CANDLE" });
        }
        if (lower.includes("bearish candle") || lower.includes("red candle")) {
          rules.push({ type: "price_action", action: "BEARISH_CANDLE" });
        }
      }
    };

    parseConditions(strategy.buy_entry_logic?.conditions || [], "buy");
    parseConditions(strategy.sell_entry_logic?.conditions || [], "sell");

    if (buyRules.length === 0) {
      buyRules.push({ type: "indicator", name: "RSI", period: 14, operator: "<", value: 40 });
      indicators.push({ name: "RSI" as any, period: 14 });
    }
    
    if (sellRules.length === 0) {
      sellRules.push({ type: "indicator", name: "RSI", period: 14, operator: ">", value: 60 });
    }

    const slPercent = (strategy.buy_stop_loss?.parameters?.percentage as number) || 2;
    const targetPercent = (strategy.buy_target?.parameters?.percentage as number) || 4;

    console.log("[StrategyService] Created fallback executable strategy with", buyRules.length, "buy rules and", sellRules.length, "sell rules");

      return {
        name: strategy.name,
        description: strategy.description,
        version: 1,
        buy: { logic: "OR", rules: buyRules },
        sell: { logic: "OR", rules: sellRules },
        buyExit: {
          stopLoss: { type: "PERCENTAGE", value: slPercent },
          target: { type: "PERCENTAGE", value: targetPercent },
        },
        sellExit: {
          stopLoss: { type: "PERCENTAGE", value: slPercent },
          target: { type: "PERCENTAGE", value: targetPercent },
        },
        requiredIndicators: indicators as any,
        minWarmupCandles: 20,
      };
    }

    async improveStrategyWithAI(
      strategy: StructuredStrategy,
      backtestResults: BacktestResult
    ): Promise<{ improved: StructuredStrategy; notes: string }> {
      const messages = [
        {
          role: "system",
          content: `You are an expert trading strategy optimizer. Analyze the given strategy and its backtest results, then provide an IMPROVED version.
  
  ### STRATEGY CLASSIFICATION:
  Identify/Maintain the strategy type:
  - INTRADAY: Entry and Exit happen on the same day. All positions MUST exit before 3:20 PM.
  - SWING: Positions held for multiple days.
  - SCALPING: Very short term trades (minutes).
  - OPTIONS: Strategies specifically mentioning options or complex Greeks.
  
  Focus on:
  1. Entry/exit timing optimization
  2. Stop loss and target adjustments based on win/loss patterns
  3. Filter improvements to reduce false signals
  4. Trailing stop loss optimization
  5. Hold/no-trade condition refinements
  
  OUTPUT FORMAT (JSON):
  {
    "improved": { 
      "name": "Strategy Name",
      "description": "...",
      "strategy_type": "...",
      "buy_entry_logic": { "conditions": [...] },
      ...
    },
    "notes": "Detailed explanation of what was changed and why"
  }`,
        },
        {
          role: "user",
          content: `Improve this strategy based on backtest results:
  
  CURRENT STRATEGY:
  ${JSON.stringify(strategy, null, 2)}
  
  BACKTEST RESULTS:
  - Total Trades: ${backtestResults.total_trades}
  - Win Rate: ${backtestResults.win_rate}%
  - Loss Rate: ${backtestResults.loss_rate}%
  - Net P&L: ₹${backtestResults.net_pnl} (${backtestResults.net_pnl_percentage}%)
  - Max Drawdown: ₹${backtestResults.max_drawdown} (${backtestResults.max_drawdown_percentage}%)
  
  TRADE LOG SUMMARY:
  ${JSON.stringify(backtestResults.trade_log.slice(0, 10), null, 2)}`,
        },
      ];
  
      const result = await aiSharedService.executeAnalysis("strategy_improve", messages, {
        maxTokens: 3000,
        skipCache: true,
      });
  
      if (!result.success || !result.result) {
        throw new Error("AI failed to improve strategy");
      }
  
      try {
        let jsonString = typeof result.result === "string" ? result.result : JSON.stringify(result.result);
        const firstBrace = jsonString.indexOf("{");
        const lastBrace = jsonString.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }
        const parsed = JSON.parse(jsonString);
        
        // Robust field insurance
        const ensureFields = (obj: any) => {
          if (!obj) return { name: "Improved Strategy", description: "Improved by AI" };
          const fields = [
            "buy_entry_logic", "buy_stop_loss", "buy_target", "buy_trailing_sl",
            "sell_entry_logic", "sell_stop_loss", "sell_target", "sell_trailing_sl",
            "hold_logic"
          ];
          fields.forEach(field => {
            if (!obj[field]) obj[field] = { conditions: [] };
            if (!obj[field].conditions) obj[field].conditions = [];
          });
          if (!obj.name) obj.name = strategy.name + " (Improved)";
          if (!obj.description) obj.description = strategy.description;
          if (!obj.strategy_type) obj.strategy_type = strategy.strategy_type || "SWING";
          return obj;
        };
  
        if (parsed.improved) {
          parsed.improved = ensureFields(parsed.improved);
          if (!parsed.notes) parsed.notes = "Strategy improved with optimized parameters.";
        } else if (parsed.name) {
          // If AI returned the strategy directly instead of wrapped in "improved"
          const improved = ensureFields(parsed);
          return { improved, notes: parsed.notes || "Strategy improved with optimized parameters." };
        }
  
        return parsed as { improved: StructuredStrategy; notes: string };
      } catch (e) {
        console.error("[StrategyService] Failed to parse AI improvement response:", e);
        throw new Error("Failed to parse AI improvement response");
      }
    }


  private async fetchCandlesFromZerodha(
    instrumentToken: number,
    timeframe: string,
    fromDate: Date,
    toDate: Date,
    zerodhaConfigId?: string
  ): Promise<Candle[]> {
    try {
      let config = null;
      if (zerodhaConfigId) {
        const { data } = await supabaseAdmin
          .from("admin_zerodha_configs")
          .select("*")
          .eq("id", zerodhaConfigId)
          .single();
        config = data;
      } else {
        config = await marketDataEngine.getActiveConfig();
      }

      if (!config || !config.access_token) {
        console.log("[StrategyService] No valid Zerodha config found", zerodhaConfigId ? `for ID ${zerodhaConfigId}` : "");
        return [];
      }

      const apiKey = decrypt(config.api_key);
      const accessToken = decrypt(config.access_token);
      const interval = getZerodhaInterval(timeframe);
      const fromStr = fromDate.toISOString().split("T")[0];
      const toStr = toDate.toISOString().split("T")[0];

      console.log(`[StrategyService] Fetching from Zerodha: ${instrumentToken} ${interval} from ${fromStr} to ${toStr}`);

      const response = await fetch(
        `https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}?from=${fromStr}&to=${toStr}`,
        {
          headers: {
            "X-Kite-Version": "3",
            Authorization: `token ${apiKey}:${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        console.error("[StrategyService] Zerodha API error:", error);
        return [];
      }

      const data = await response.json();
      const rawCandles = data.data?.candles || [];

      console.log(`[StrategyService] Got ${rawCandles.length} candles from Zerodha`);

      const candles: Candle[] = rawCandles.map((c: (string | number)[]) => ({
        timestamp: c[0] as string,
        open: c[1] as number,
        high: c[2] as number,
        low: c[3] as number,
        close: c[4] as number,
        volume: c[5] as number,
      }));

      if (candles.length > 0) {
        const normalizedTf = normalizeTimeframe(timeframe);
        const rows = candles.map(c => ({
          instrument_token: instrumentToken,
          timeframe: normalizedTf,
          timestamp: new Date(c.timestamp).toISOString(),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          oi: 0,
        }));

        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          await supabaseAdmin
            .from("live_candles")
            .upsert(batch, { onConflict: "instrument_token,timeframe,timestamp" });
        }
        console.log(`[StrategyService] Cached ${rows.length} candles in live_candles`);
      }

      return candles;
    } catch (error) {
      console.error("[StrategyService] Error fetching from Zerodha:", error);
      return [];
    }
  }

  async runBacktest(
    strategy: StructuredStrategy,
    instrumentTokens: number[],
    timeframe: string,
    capital: number = 100000,
    fromDate?: Date,
    toDate?: Date,
    zerodhaConfigId?: string
  ): Promise<BacktestResult> {
    if (instrumentTokens.length === 0) {
      throw new Error("At least one instrument is required for backtesting");
    }
    if (instrumentTokens.length > 2) {
      throw new Error("Maximum 2 instruments allowed per backtest");
    }

    const lookback = TIMEFRAME_LOOKBACK[timeframe] || TIMEFRAME_LOOKBACK[normalizeTimeframe(timeframe)] || { days: 100 };
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - lookback.days * 24 * 60 * 60 * 1000);
    
    const from = fromDate || defaultFrom;
    const to = toDate || now;
    const normalizedTf = normalizeTimeframe(timeframe);

    let allCandles: Candle[] = [];
    let dataSource = "historical_candles";

    const { getCandles } = await import("./candle-service");

    for (const instrumentToken of instrumentTokens) {
      console.log(`[StrategyService] Requesting candles from CandleService for ${instrumentToken} ${normalizedTf}`);
      
      const result = await getCandles({
        instrumentToken,
        timeframe: normalizedTf,
        mode: "BACKTEST",
        fromDate: from,
        toDate: to,
      });

      if (result.candles && result.candles.length > 0) {
        const candles: Candle[] = result.candles.map(c => ({
          timestamp: c.timestamp.toISOString(),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));
        
        console.log(`[StrategyService] Received ${candles.length} candles from ${result.source}`);
        // IMPORTANT: Process each instrument separately or ensure they don't interleave in a way that breaks indicators
        // For backtesting, it's best to run per-instrument and aggregate results
        const instrumentResult = this.executeBacktest(strategy, candles, capital / instrumentTokens.length);
        
        if (allCandles.length === 0) {
          // Initialize with first instrument's aggregated result structure
          (this as any).aggregatedResult = { ...instrumentResult, trade_log: [...instrumentResult.trade_log] };
        } else {
          // Merge results
          const agg = (this as any).aggregatedResult;
          agg.total_trades += instrumentResult.total_trades;
          agg.buy_count += instrumentResult.buy_count;
          agg.sell_count += instrumentResult.sell_count;
          agg.hold_count += instrumentResult.hold_count;
          agg.net_pnl += instrumentResult.net_pnl;
          agg.net_pnl_percentage = (agg.net_pnl / capital) * 100;
          agg.trade_log = [...agg.trade_log, ...instrumentResult.trade_log].sort((a, b) => 
            new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
          );
          // Simplified Win Rate merge
          const totalWins = (agg.win_rate * (agg.total_trades - instrumentResult.total_trades) / 100) + 
                          (instrumentResult.win_rate * instrumentResult.total_trades / 100);
          agg.win_rate = agg.total_trades > 0 ? (totalWins / agg.total_trades) * 100 : 0;
          agg.max_drawdown = Math.max(agg.max_drawdown, instrumentResult.max_drawdown);
        }

        allCandles = allCandles.concat(candles);
        dataSource = result.source;
      }
    }

    if (allCandles.length === 0) {
      throw new Error("No data available for backtesting. We tried to fetch it automatically but failed. This could be due to invalid instrument tokens or market holidays.");
    }

    const finalResult = (this as any).aggregatedResult || this.executeBacktest(strategy, allCandles, capital);
    delete (this as any).aggregatedResult;
    
    return {
      ...finalResult,
      data_source: dataSource,
      candle_count: allCandles.length,
      date_range: {
        from: allCandles[0]?.timestamp || from.toISOString(),
        to: allCandles[allCandles.length - 1]?.timestamp || to.toISOString(),
      },
    };
  }

  private executeBacktest(
    strategy: StructuredStrategy,
    candles: Candle[],
    capital: number
  ): BacktestResult & { evaluation_logs?: EvaluationLog[] } {
    const trades: TradeEntry[] = [];
    let currentPosition: TradeEntry | null = null;
    let cashBalance = capital;
    let peakBalance = capital;
    let maxDrawdown = 0;
    let wins = 0;
    let losses = 0;
    const evaluationLogs: EvaluationLog[] = [];

    const useNewExecutor = !!strategy.executable_strategy;
    let executor: StrategyRuleExecutor | null = null;
    let indicatorData: Record<string, any> = {};
    let warmupPeriod = 20;

    if (useNewExecutor && strategy.executable_strategy) {
      console.log("[Backtest] Using NEW executable strategy engine");
      console.log("[Backtest] Strategy rules:", JSON.stringify({
        buyRules: strategy.executable_strategy.buy?.rules?.length || 0,
        buyLogic: strategy.executable_strategy.buy?.logic,
        sellRules: strategy.executable_strategy.sell?.rules?.length || 0,
        sellLogic: strategy.executable_strategy.sell?.logic,
        firstBuyRule: strategy.executable_strategy.buy?.rules?.[0],
        firstSellRule: strategy.executable_strategy.sell?.rules?.[0],
      }, null, 2));
      executor = new StrategyRuleExecutor(true);
      executor.precalculateIndicators(candles as CalcCandle[], strategy.executable_strategy);
      warmupPeriod = getRequiredWarmupPeriod(strategy.executable_strategy);
      console.log(`[Backtest] Warmup period: ${warmupPeriod} candles`);
    } else {
      console.log("[Backtest] Using LEGACY string-based evaluator (fallback)");
      indicatorData = StrategyEvaluator.precalculateIndicators(candles as CalcCandle[]);
    }

    console.log(`[Backtest] Processing ${candles.length} candles, starting from index ${warmupPeriod}`);
    let buySignalCount = 0;
    let sellSignalCount = 0;

    for (let i = warmupPeriod; i < candles.length; i++) {
      const candle = candles[i];
      
      let buySignal = false;
      let sellSignal = false;
      let holdInfo = false;

      if (useNewExecutor && executor && strategy.executable_strategy) {
        const result = executor.evaluate(strategy.executable_strategy, i);
        buySignal = result.buySignal;
        sellSignal = result.sellSignal;
        holdInfo = result.holdInfo;
        
        if (i === warmupPeriod || i === warmupPeriod + 1 || i === warmupPeriod + 2) {
          console.log(`[Backtest] Sample eval candle ${i}:`, JSON.stringify({
            close: candle.close,
            buyResult: result.log.buyEvaluation.result,
            buyRuleResults: result.log.buyEvaluation.ruleResults.map(r => ({
              passed: r.passed,
              reason: r.reason
            })),
            sellResult: result.log.sellEvaluation.result,
            sellRuleResults: result.log.sellEvaluation.ruleResults.map(r => ({
              passed: r.passed,
              reason: r.reason
            })),
          }, null, 2));
        }
        
        if (i < warmupPeriod + 5 || result.buySignal || result.sellSignal) {
          evaluationLogs.push(result.log);
          if (result.buySignal || result.sellSignal) {
            console.log(`[Backtest] Candle ${i}: ${result.log.finalSignal} - ${result.log.signalReason.substring(0, 100)}`);
          }
        }
      } else {
        const evaluation = StrategyEvaluator.evaluate(strategy, candles as CalcCandle[], i, indicatorData);
        buySignal = evaluation.buySignal;
        sellSignal = evaluation.sellSignal;
        holdInfo = evaluation.holdSignal;
      }

      if (buySignal) buySignalCount++;
      if (sellSignal) sellSignalCount++;

      if (currentPosition) {
        const entryPrice = currentPosition.entry_price;
        let shouldExit = false;
        let exitReason = "";
        let exitPrice = candle.close;

        const execStrategy = strategy.executable_strategy;

        if (currentPosition.type === "BUY") {
          let slPercent = 2;
          let targetPercent = 4;

          if (execStrategy?.buyExit?.stopLoss) {
            slPercent = execStrategy.buyExit.stopLoss.value;
          } else if (strategy.buy_stop_loss?.parameters?.percentage) {
            slPercent = strategy.buy_stop_loss.parameters.percentage as number;
          }
          
          if (execStrategy?.buyExit?.target) {
            targetPercent = execStrategy.buyExit.target.value;
          } else if (strategy.buy_target?.parameters?.percentage) {
            targetPercent = strategy.buy_target.parameters.percentage as number;
          }

          const slPrice = entryPrice * (1 - slPercent / 100);
          
          if (candle.low <= slPrice) {
            shouldExit = true;
            exitReason = "Stop Loss Hit";
            exitPrice = slPrice;
          }

          const targetPrice = entryPrice * (1 + targetPercent / 100);

          if (candle.high >= targetPrice && !shouldExit) {
            shouldExit = true;
            exitReason = "Target Hit";
            exitPrice = targetPrice;
          }

          if (sellSignal && !shouldExit) {
            shouldExit = true;
            exitReason = "Sell Signal";
          }

          // Intraday Square-off logic
          const isIntraday = strategy.strategy_type === "INTRADAY" || execStrategy?.strategyType === "INTRADAY";
          if (isIntraday && !shouldExit) {
            const candleDate = new Date(candle.timestamp);
            const hour = candleDate.getHours();
            const minute = candleDate.getMinutes();
            
            // Indian markets square off around 3:15 PM - 3:20 PM
            if (hour > 15 || (hour === 15 && minute >= 15)) {
              shouldExit = true;
              exitReason = "Intraday Square-off";
              exitPrice = candle.close;
            } else if (i < candles.length - 1) {
              // Check if next candle is on a different day
              const nextCandleDate = new Date(candles[i+1].timestamp);
              if (candleDate.getDate() !== nextCandleDate.getDate()) {
                shouldExit = true;
                exitReason = "Intraday End-of-Day";
                exitPrice = candle.close;
              }
            }
          }
        } else {
          let slPercent = 2;
          let targetPercent = 4;

          if (execStrategy?.sellExit?.stopLoss) {
            slPercent = execStrategy.sellExit.stopLoss.value;
          } else if (strategy.sell_stop_loss?.parameters?.percentage) {
            slPercent = strategy.sell_stop_loss.parameters.percentage as number;
          }
          
          if (execStrategy?.sellExit?.target) {
            targetPercent = execStrategy.sellExit.target.value;
          } else if (strategy.sell_target?.parameters?.percentage) {
            targetPercent = strategy.sell_target.parameters.percentage as number;
          }

          const slPrice = entryPrice * (1 + slPercent / 100);

          if (candle.high >= slPrice) {
            shouldExit = true;
            exitReason = "Stop Loss Hit";
            exitPrice = slPrice;
          }

          const targetPrice = entryPrice * (1 - targetPercent / 100);

          if (candle.low <= targetPrice && !shouldExit) {
            shouldExit = true;
            exitReason = "Target Hit";
            exitPrice = targetPrice;
          }

          if (buySignal && !shouldExit) {
            shouldExit = true;
            exitReason = "Buy Signal";
          }
        }

        if (shouldExit) {
          const pnl = currentPosition.type === "BUY"
            ? (exitPrice - entryPrice) * currentPosition.quantity
            : (entryPrice - exitPrice) * currentPosition.quantity;

          currentPosition.exit_time = candle.timestamp;
          currentPosition.exit_price = exitPrice;
          currentPosition.pnl = pnl;
          currentPosition.pnl_percentage = (pnl / (entryPrice * currentPosition.quantity)) * 100;
          currentPosition.exit_reason = exitReason;

          cashBalance += pnl;
          if (pnl > 0) wins++;
          else losses++;

          if (cashBalance > peakBalance) peakBalance = cashBalance;
          const drawdown = peakBalance - cashBalance;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;

          trades.push(currentPosition);
          currentPosition = null;
        }
      }

      if (!currentPosition) {
        if (buySignal) {
          const quantity = Math.floor((cashBalance * 0.95) / candle.close);
          if (quantity > 0) {
            currentPosition = {
              id: `trade-${trades.length + 1}`,
              type: "BUY",
              entry_time: candle.timestamp,
              entry_price: candle.close,
              quantity,
            };
            console.log(`[Backtest] BUY Entry at candle ${i}: price=${candle.close}, qty=${quantity}`);
          }
        } else if (sellSignal) {
          const quantity = Math.floor((cashBalance * 0.95) / candle.close);
          if (quantity > 0) {
            currentPosition = {
              id: `trade-${trades.length + 1}`,
              type: "SELL",
              entry_time: candle.timestamp,
              entry_price: candle.close,
              quantity,
            };
            console.log(`[Backtest] SELL Entry at candle ${i}: price=${candle.close}, qty=${quantity}`);
          }
        }
      }
    }

    if (currentPosition) {
      const lastCandle = candles[candles.length - 1];
      const pnl = currentPosition.type === "BUY"
        ? (lastCandle.close - currentPosition.entry_price) * currentPosition.quantity
        : (currentPosition.entry_price - lastCandle.close) * currentPosition.quantity;

      currentPosition.exit_time = lastCandle.timestamp;
      currentPosition.exit_price = lastCandle.close;
      currentPosition.pnl = pnl;
      currentPosition.pnl_percentage = (pnl / (currentPosition.entry_price * currentPosition.quantity)) * 100;
      currentPosition.exit_reason = "End of Data";

      cashBalance += pnl;
      if (pnl > 0) wins++;
      else losses++;

      trades.push(currentPosition);
    }

    const totalTrades = trades.length;
    const netPnl = cashBalance - capital;
    const buyCount = trades.filter(t => t.type === "BUY").length;
    const sellCount = trades.filter(t => t.type === "SELL").length;

    console.log(`[Backtest] COMPLETE: ${totalTrades} trades, BUY signals: ${buySignalCount}, SELL signals: ${sellSignalCount}`);
    console.log(`[Backtest] P&L: ${netPnl.toFixed(2)} (${((netPnl/capital)*100).toFixed(2)}%), Win Rate: ${totalTrades > 0 ? ((wins/totalTrades)*100).toFixed(1) : 0}%`);

    return {
      capital_used: capital,
      total_trades: totalTrades,
      buy_count: buyCount,
      sell_count: sellCount,
      hold_count: candles.length - warmupPeriod - totalTrades,
      net_pnl: netPnl,
      net_pnl_percentage: (netPnl / capital) * 100,
      win_rate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      loss_rate: totalTrades > 0 ? (losses / totalTrades) * 100 : 0,
      max_drawdown: maxDrawdown,
      max_drawdown_percentage: peakBalance > 0 ? (maxDrawdown / peakBalance) * 100 : 0,
      trade_log: trades,
      data_source: "pending",
      candle_count: 0,
      date_range: { from: "", to: "" },
      evaluation_logs: evaluationLogs.slice(0, 50),
    };
  }

  async getAvailableTimeframes(instrumentToken: number): Promise<string[]> {
    const { data } = await supabaseAdmin
      .from("live_candles")
      .select("timeframe")
      .eq("instrument_token", instrumentToken)
      .limit(1000);

    if (!data) return [];

    const timeframes = new Set(data.map(d => d.timeframe));
    return Array.from(timeframes);
  }

  async saveStrategy(
    userId: string,
    strategy: StructuredStrategy,
    rawInput: string,
    selectedTimeframes: string[],
    visibility: "private" | "public" | "invite_only",
    isPaperTrading: boolean = false,
    selectedInstruments: number[] = []
  ): Promise<number> {
    if (strategy.executable_strategy) {
      const validation = validateStrategy(strategy.executable_strategy);
      if (!validation.valid) {
        console.warn("[StrategyService] Saving strategy with validation issues:", validation.errors);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("strategies")
      .insert({
        user_id: userId,
        name: strategy.name,
        description: strategy.description,
        raw_input: rawInput,
        buy_entry_logic: strategy.buy_entry_logic,
        buy_stop_loss: strategy.buy_stop_loss,
        buy_target: strategy.buy_target,
        buy_trailing_sl: strategy.buy_trailing_sl,
        sell_entry_logic: strategy.sell_entry_logic,
        sell_stop_loss: strategy.sell_stop_loss,
        sell_target: strategy.sell_target,
        sell_trailing_sl: strategy.sell_trailing_sl,
        hold_logic: strategy.hold_logic,
        executable_strategy: strategy.executable_strategy || null,
        selected_timeframes: selectedTimeframes,
        selected_instruments: selectedInstruments,
        is_paper_trading: isPaperTrading,
        visibility,
        is_finalized: true,
        status: "finalized",
        version: 1,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("Failed to save strategy");
    }

    await this.saveVersionSnapshot(data.id, 1, strategy);

    return data.id;
  }

  async updateStrategy(
    strategyId: number,
    strategy: StructuredStrategy,
    selectedTimeframes?: string[]
  ): Promise<void> {
    const { data: current } = await supabaseAdmin
      .from("strategies")
      .select("version, improvement_count")
      .eq("id", strategyId)
      .single();

    const newVersion = (current?.version || 1) + 1;

    const { error } = await supabaseAdmin
      .from("strategies")
      .update({
        name: strategy.name,
        description: strategy.description,
        buy_entry_logic: strategy.buy_entry_logic,
        buy_stop_loss: strategy.buy_stop_loss,
        buy_target: strategy.buy_target,
        buy_trailing_sl: strategy.buy_trailing_sl,
        sell_entry_logic: strategy.sell_entry_logic,
        sell_stop_loss: strategy.sell_stop_loss,
        sell_target: strategy.sell_target,
        sell_trailing_sl: strategy.sell_trailing_sl,
        hold_logic: strategy.hold_logic,
        executable_strategy: strategy.executable_strategy || null,
        selected_timeframes: selectedTimeframes,
        version: newVersion,
        improvement_count: (current?.improvement_count || 0) + 1,
      })
      .eq("id", strategyId);

    if (error) throw new Error("Failed to update strategy");

    await this.saveVersionSnapshot(strategyId, newVersion, strategy);
  }

  private async saveVersionSnapshot(
    strategyId: number,
    version: number,
    strategy: StructuredStrategy
  ): Promise<void> {
    await supabaseAdmin.from("strategy_versions").insert({
      strategy_id: strategyId,
      version: version,
      buy_entry_logic: strategy.buy_entry_logic,
      buy_stop_loss: strategy.buy_stop_loss,
      buy_target: strategy.buy_target,
      buy_trailing_sl: strategy.buy_trailing_sl,
      sell_entry_logic: strategy.sell_entry_logic,
      sell_stop_loss: strategy.sell_stop_loss,
      sell_target: strategy.sell_target,
      sell_trailing_sl: strategy.sell_trailing_sl,
      hold_logic: strategy.hold_logic,
    });
  }

  async saveBacktestResult(
    strategyId: number,
    version: number,
    instrumentTokens: number[],
    timeframe: string,
    result: BacktestResult,
    strategySnapshot: StructuredStrategy
  ): Promise<void> {
    await supabaseAdmin.from("strategy_backtests").insert({
      strategy_id: strategyId,
      strategy_version: version,
      instrument_token: instrumentTokens[0],
      timeframe,
      ...result,
      strategy_snapshot: strategySnapshot,
    });
  }

  async getUserStrategies(userId: string): Promise<unknown[]> {
    const { data } = await supabaseAdmin
      .from("strategies")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return data || [];
  }

  async getPublicStrategies(): Promise<unknown[]> {
    const { data } = await supabaseAdmin
      .from("strategies")
      .select(`
        id, name, description, visibility, is_active,
        selected_timeframes, created_at, user_id,
        profiles:user_id (username, avatar_url)
      `)
      .eq("admin_approved", true)
      .in("visibility", ["public", "invite_only"])
      .order("created_at", { ascending: false });

    return (data || []).map(s => ({
      ...s,
      buy_entry_logic: s.visibility === "invite_only" ? null : undefined,
      sell_entry_logic: s.visibility === "invite_only" ? null : undefined,
    }));
  }

  async checkAccess(strategyId: number, userId: string): Promise<boolean> {
    const { data: strategy } = await supabaseAdmin
      .from("strategies")
      .select("user_id, visibility")
      .eq("id", strategyId)
      .single();

    if (!strategy) return false;
    if (strategy.user_id === userId) return true;
    if (strategy.visibility === "public") return true;

    if (strategy.visibility === "invite_only") {
      const { data: grant } = await supabaseAdmin
        .from("strategy_access_grants")
        .select("id, expires_at, is_revoked")
        .eq("strategy_id", strategyId)
        .eq("user_id", userId)
        .single();

      if (grant && !grant.is_revoked) {
        if (!grant.expires_at || new Date(grant.expires_at) > new Date()) {
          return true;
        }
      }
    }

    return false;
  }
}

export const strategyService = StrategyService.getInstance();
