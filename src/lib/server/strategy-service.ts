import { supabaseAdmin } from "@/lib/supabase/admin";
import { aiSharedService } from "./ai-shared-service";
import { marketDataEngine } from "./market-data-engine";
import { decrypt } from "./encryption";
import { IndicatorCalculator, type Candle as CalcCandle } from "./indicator-calculator";
import { StrategyEvaluator } from "./strategy-evaluator";
import { StrategyRuleExecutor, formatEvaluationLogForDisplay } from "./strategy-rule-executor";
import { processZairoth } from "@/lib/zairoth";
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
  ai_analysis_enabled?: boolean;
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

    async formatStrategyWithAI(rawInput: string, aiAnalysisEnabled: boolean = false): Promise<StructuredStrategy & { zairoth_intent?: string }> {
      // Phase 1: Generate ZAIROTH Intent (Backend only, hidden from user)
      const zairothResult = await aiSharedService.generateZairothIntent(rawInput);
      let zairothContext = "";
      let zairothIntent = "";
      
      if (zairothResult.success && zairothResult.zairoth) {
        zairothIntent = zairothResult.zairoth.raw;
        zairothContext = `INTERNAL INTENT (ZAIROTH):\n${zairothIntent}\n\n`;
        
        // Log the intent
        await aiSharedService.logZairothIntent(
          rawInput,
          zairothIntent,
          { valid: true },
          zairothResult.zairoth.canonical,
          "Strategy formatting initiated"
        );
      }

      const messages = [
          {
            role: "system",
            content: `You are an Expert Professional Trader AI with 10+ years of discretionary trading experience.
You are NOT an indicator calculator. You are a DECISION-MAKING TRADER.

${zairothContext}
${aiAnalysisEnabled ? `
### 🧠 EXPERT AI TRADER MODE: ENABLED
CORE PRINCIPLE (NON-NEGOTIABLE):
- Strategies define WHEN to trade.
- AI Analysis defines WHEN NOT to trade.
- Your job is TRADE SELECTION, not rule explosion.

HOW YOU MUST THINK:
1. "Is this setup valid in this market context?"
2. "Is this a high-probability trade or just a valid signal?"
3. "Would an experienced trader skip this trade?"
4. "Where do most traders lose money with this strategy?"

AI ANALYSIS GATES (Add these as execution filters):
🔹 Market Regime Check:
   - Is market Trending, Ranging, or Choppy?
   - ADX > 25 = Trending (good for momentum strategies)
   - ADX < 20 = Ranging (good for mean reversion, avoid breakouts)

🔹 Trade Quality Check:
   - Momentum strength (RSI slope, MACD histogram direction)
   - Volatility expansion vs contraction (ATR comparison)
   - Proximity to key levels (VWAP, Day High/Low)

🔹 Risk Avoidance Rules:
   - Block trades during sudden volatility spikes
   - Block trades on overextended candles (>2x ATR)
   - Skip re-entry if just stopped out

COMBINED EXECUTION OUTPUT:
For each entry condition, AI must provide:
- Strategy Rule (original logic) 
- AI Analysis Gate (expert judgment)
- Execution Decision (✅ Allowed / ❌ Blocked)
- Reason (human-readable)

TARGET OUTCOME:
Improve effective trade quality from ~20-30% to 60-80% win rate
by AVOIDING bad trades, not forcing more trades.

KEY PHILOSOPHY:
"A good trader does not trade often. A good trader trades well-selected moments."
"The edge is not in the strategy. The edge is in TRADE SELECTION."
` : ""}

### STRATEGY TYPES:
- INTRADAY: Same-day entry/exit. Must exit by 3:15 PM IST.
- SWING: Positions held 2-15 days.
- POSITIONAL: Positions held weeks to months.

### AVAILABLE INDICATORS (with standard periods):
| Indicator | Type | Default Period | Usage |
|-----------|------|----------------|-------|
| RSI | Oscillator | 14 | Overbought >65, Oversold <35 |
| EMA | Trend | 9, 20, 50, 200 | Price crossovers, trend direction |
| SMA | Trend | 20, 50, 200 | Support/resistance, trend |
| MACD | Momentum | 12,26,9 | Signal line crossovers, histogram |
| SUPERTREND | Trend | 10,3 | Direction: BULLISH/BEARISH |
| BB_UPPER/BB_LOWER | Volatility | 20,2 | Band breakouts |
| ADX | Trend Strength | 14 | >25 = trending, <20 = ranging |
| VWAP | Volume | - | Intraday fair value |
| ATR | Volatility | 14 | Stop loss sizing |

### RULE TYPES (like Chartink scanner):
1. **indicator**: Compare indicator to a value
   \`{ "type": "indicator", "name": "RSI", "period": 14, "operator": "<", "value": 35 }\`

2. **price_vs_indicator**: Compare price (close/high/low/open) to indicator
   \`{ "type": "price_vs_indicator", "priceField": "close", "operator": "CROSS_ABOVE", "indicator": "EMA", "indicatorPeriod": 20 }\`

3. **indicator_vs_indicator**: Compare two indicators (like EMA crossover)
   \`{ "type": "indicator_vs_indicator", "indicator1": "EMA", "period1": 9, "indicator2": "EMA", "period2": 21, "operator": "CROSS_ABOVE" }\`

4. **trend**: Supertrend/ADX direction
   \`{ "type": "trend", "indicator": "SUPERTREND", "direction": "BULLISH" }\`

### OPERATORS:
- Comparison: "<", ">", "<=", ">=", "=="
- Crossovers: "CROSS_ABOVE", "CROSS_BELOW" (for detecting when line A crosses line B)

### LOGIC:
- "OR": ANY rule triggers signal (more trades, good for catching moves)
- "AND": ALL rules must be true (fewer but higher quality trades)

### OUTPUT JSON:
{
  "name": "Strategy Name",
  "description": "Clear description with entry/exit logic",
  "strategy_type": "INTRADAY" | "SWING" | "POSITIONAL",
  "buy_entry_logic": { 
    "conditions": ["Close crosses above EMA(20)", "RSI(14) < 40"],
    "indicators": ["EMA(20)", "RSI(14)"]
  },
  "sell_entry_logic": { 
    "conditions": ["Close crosses below EMA(20)", "RSI(14) > 60"],
    "indicators": ["EMA(20)", "RSI(14)"]
  },
  "buy_stop_loss": { "parameters": { "percentage": 1.5 } },
  "buy_target": { "parameters": { "percentage": 3.0 } },
  "sell_stop_loss": { "parameters": { "percentage": 1.5 } },
  "sell_target": { "parameters": { "percentage": 3.0 } },
  "buy_trailing_sl": { "conditions": [] },
  "sell_trailing_sl": { "conditions": [] },
  "hold_logic": { "conditions": [] },
  "executable_strategy": {
    "name": "Strategy Name",
    "strategyType": "INTRADAY",
    "version": 1,
    "buy": { 
      "logic": "OR", 
      "rules": [
        { "type": "price_vs_indicator", "priceField": "close", "operator": "CROSS_ABOVE", "indicator": "EMA", "indicatorPeriod": 20 },
        { "type": "indicator", "name": "RSI", "period": 14, "operator": "<", "value": 35 }
      ] 
    },
    "sell": { 
      "logic": "OR", 
      "rules": [
        { "type": "price_vs_indicator", "priceField": "close", "operator": "CROSS_BELOW", "indicator": "EMA", "indicatorPeriod": 20 },
        { "type": "indicator", "name": "RSI", "period": 14, "operator": ">", "value": 65 }
      ] 
    },
    "buyExit": { "stopLoss": { "type": "PERCENTAGE", "value": 1.5 }, "target": { "type": "PERCENTAGE", "value": 3.0 } },
    "sellExit": { "stopLoss": { "type": "PERCENTAGE", "value": 1.5 }, "target": { "type": "PERCENTAGE", "value": 3.0 } },
    "requiredIndicators": [
      { "name": "EMA", "period": 20 },
      { "name": "RSI", "period": 14 }
    ],
    "minWarmupCandles": 30
  }
}

### CRITICAL RULES:
1. Use "OR" logic for buy/sell to generate more signals
2. Keep rules simple: 1-2 conditions max per entry
3. RSI thresholds: oversold 30-40, overbought 60-70 (NOT extreme 20/80)
4. Stop loss: 1-2% for intraday, 2-4% for swing
5. Target: 1.5x to 2x of stop loss (risk-reward ratio)`,
          },
      {
        role: "user",
        content: `Create a profitable trading strategy based on this idea. Make it simple and tradeable:\n\n${rawInput}`,
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

            let finalized = ensureFields(parsed);
            
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
            
            // Sync strings with objects
            finalized = this.syncConditionsWithExecutable(finalized);
            
            return finalized as StructuredStrategy;
        } catch (e) {
          console.error("[StrategyService] Failed to parse AI response:", e);
          throw new Error("Failed to parse AI response");
        }
      }

  private sanitizeExecutableStrategy(strategy: ExecutableStrategy): ExecutableStrategy {
    const sanitizeRules = (rules: any[] = []) => {
      return rules.map(rule => {
        // Fix missing type
        if (!rule.type) {
          if (rule.indicator && rule.priceField) rule.type = "price_vs_indicator";
          else if (rule.indicator1 && rule.indicator2) rule.type = "indicator_vs_indicator";
          else if (rule.name || (rule.indicator && rule.value !== undefined)) rule.type = "indicator";
          else if (rule.indicator === "SUPERTREND" || rule.indicator === "ADX") rule.type = "trend";
          else if (rule.pattern) rule.type = "pattern";
          else if (rule.action) rule.type = "price_action";
          else if (rule.operator && (rule.value !== undefined || rule.compareToAverage)) rule.type = "volume";
        }

        // Fix keys
        if (rule.condition && !rule.operator) rule.operator = rule.condition;
        if (rule.indicator && !rule.name && rule.type === "indicator") rule.name = rule.indicator;
        if (rule.period && !rule.indicatorPeriod && rule.type === "price_vs_indicator") rule.indicatorPeriod = rule.period;
        
        // Map common string operators to constants
        const opMap: Record<string, string> = {
          "cross above": "CROSS_ABOVE",
          "crosses above": "CROSS_ABOVE",
          "crossed above": "CROSS_ABOVE",
          "cross below": "CROSS_BELOW",
          "crosses below": "CROSS_BELOW",
          "crossed below": "CROSS_BELOW",
          "above": ">",
          "below": "<",
          "greater than": ">",
          "less than": "<",
          "equal": "==",
          "equals": "==",
          "between": "BETWEEN"
        };

        if (typeof rule.operator === "string" && opMap[rule.operator.toLowerCase()]) {
          rule.operator = opMap[rule.operator.toLowerCase()];
        }

        // Fix BETWEEN operator - convert to simple comparison if no second value
        if (rule.operator === "BETWEEN" && !rule.value2 && !rule.maxValue) {
          rule.operator = "<";
          rule.value = 60;
        }

        // Fix overly strict RSI thresholds
        if (rule.type === "indicator" && rule.name === "RSI") {
          if (rule.operator === "<" && rule.value <= 30) rule.value = 40;
          if (rule.operator === ">" && rule.value >= 70) rule.value = 60;
        }

        return rule;
      });
    };

    // Remove broken indicators and unsupported rules
    const filterRules = (rules: any[] = []) => {
      const unsupported = ["ZSCORE", "Z_SCORE", "Z-SCORE", "VAP"];
      return rules.filter(rule => {
        const name = (rule.name || rule.indicator || "").toUpperCase();
        if (unsupported.includes(name)) return false;
        // Remove volume rules without proper configuration
        if (rule.type === "volume" && rule.compareToAverage && !rule.averagePeriod) {
          rule.averagePeriod = 20;
        }
        return true;
      });
    };

    if (strategy.buy?.rules) {
      strategy.buy.rules = filterRules(sanitizeRules(strategy.buy.rules));
      if (strategy.buy.rules.length <= 2) strategy.buy.logic = "OR";
      if (strategy.buy.rules.length === 0) {
        strategy.buy.rules = [{ type: "indicator", name: "RSI", period: 14, operator: "<", value: 40 }];
      }
    }

    if (strategy.sell?.rules) {
      strategy.sell.rules = filterRules(sanitizeRules(strategy.sell.rules));
      if (strategy.sell.rules.length <= 2) strategy.sell.logic = "OR";
      if (strategy.sell.rules.length === 0) {
        strategy.sell.rules = [{ type: "indicator", name: "RSI", period: 14, operator: ">", value: 60 }];
      }
    }

    // Rebuild requiredIndicators
    const indicators: Map<string, { name: any; period?: number }> = new Map();
    const collectIndicators = (rules: any[] = []) => {
      rules.forEach(rule => {
        if (rule.type === "indicator" && rule.name) {
          indicators.set(`${rule.name}_${rule.period || 14}`, { name: rule.name, period: rule.period });
        } else if (rule.type === "price_vs_indicator" && rule.indicator) {
          indicators.set(`${rule.indicator}_${rule.indicatorPeriod || 20}`, { name: rule.indicator, period: rule.indicatorPeriod });
        } else if (rule.type === "indicator_vs_indicator") {
          if (rule.indicator1) indicators.set(`${rule.indicator1}_${rule.period1 || 20}`, { name: rule.indicator1, period: rule.period1 });
          if (rule.indicator2) indicators.set(`${rule.indicator2}_${rule.period2 || 20}`, { name: rule.indicator2, period: rule.period2 });
        } else if (rule.type === "trend" && rule.indicator) {
          indicators.set(rule.indicator, { name: rule.indicator });
        }
      });
    };

    collectIndicators(strategy.buy?.rules);
    collectIndicators(strategy.sell?.rules);
    collectIndicators(strategy.hold?.rules);

    strategy.requiredIndicators = Array.from(indicators.values()) as any;
    if (!strategy.minWarmupCandles || strategy.minWarmupCandles < 30) {
      strategy.minWarmupCandles = 30;
    }

    return strategy;
  }

  private formatRuleToString(rule: any): string {
    if (!rule) return "Invalid rule";
    
    switch (rule.type) {
      case "indicator":
        return `${rule.name}${rule.period ? `(${rule.period})` : ""} ${rule.operator} ${rule.value}`;
      
      case "price_vs_indicator":
        const priceField = rule.priceField ? rule.priceField.charAt(0).toUpperCase() + rule.priceField.slice(1) : "Price";
        const multiplier = rule.multiplier && rule.multiplier !== 1 ? ` (x${rule.multiplier})` : "";
        return `${priceField} ${rule.operator.replace("_", " ")} ${rule.indicator}${rule.indicatorPeriod ? `(${rule.indicatorPeriod})` : ""}${multiplier}`;
      
      case "indicator_vs_indicator":
        return `${rule.indicator1}${rule.period1 ? `(${rule.period1})` : ""} ${rule.operator.replace("_", " ")} ${rule.indicator2}${rule.period2 ? `(${rule.period2})` : ""}`;
      
      case "trend":
        return `${rule.indicator} is ${rule.direction}`;
      
      case "volume":
        if (rule.compareToAverage) {
          return `Volume is ${rule.operator} ${rule.value || 1.5}x of ${rule.averagePeriod || 20}-period average`;
        }
        return `Volume ${rule.operator} ${rule.value}`;
      
      case "price_action":
        return `Price Action: ${rule.action.replace("_", " ")}`;
      
      case "pattern":
        return `Pattern: ${rule.pattern.replace("_", " ")}`;
      
      default:
        return JSON.stringify(rule);
    }
  }

  private syncConditionsWithExecutable(strategy: StructuredStrategy): StructuredStrategy {
    if (!strategy.executable_strategy) return strategy;
    
    const exec = strategy.executable_strategy;
    
    if (exec.buy?.rules) {
      strategy.buy_entry_logic.conditions = exec.buy.rules.map(r => this.formatRuleToString(r));
      strategy.buy_entry_logic.indicators = (exec.requiredIndicators || [])
        .filter(i => strategy.buy_entry_logic.conditions.some(c => c.includes(i.name)))
        .map(i => `${i.name}${i.period ? `(${i.period})` : ""}`);
    }
    
    if (exec.sell?.rules) {
      strategy.sell_entry_logic.conditions = exec.sell.rules.map(r => this.formatRuleToString(r));
      strategy.sell_entry_logic.indicators = (exec.requiredIndicators || [])
        .filter(i => strategy.sell_entry_logic.conditions.some(c => c.includes(i.name)))
        .map(i => `${i.name}${i.period ? `(${i.period})` : ""}`);
    }

    if (exec.buyExit?.stopLoss) {
      strategy.buy_stop_loss.parameters = { 
        ...strategy.buy_stop_loss.parameters,
        percentage: exec.buyExit.stopLoss.value,
        type: exec.buyExit.stopLoss.type
      };
    }

    if (exec.buyExit?.target) {
      strategy.buy_target.parameters = { 
        ...strategy.buy_target.parameters,
        percentage: exec.buyExit.target.value,
        type: exec.buyExit.target.type
      };
    }

    if (exec.sellExit?.stopLoss) {
      strategy.sell_stop_loss.parameters = { 
        ...strategy.sell_stop_loss.parameters,
        percentage: exec.sellExit.stopLoss.value,
        type: exec.sellExit.stopLoss.type
      };
    }

    if (exec.sellExit?.target) {
      strategy.sell_target.parameters = { 
        ...strategy.sell_target.parameters,
        percentage: exec.sellExit.target.value,
        type: exec.sellExit.target.type
      };
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
      backtestResults: BacktestResult,
      candleData?: { candles: Candle[]; indicatorValues?: Record<string, number[]> },
      strategyId?: number,
      aiEngineSuggestions?: { suggestions: string[]; optimizedParams?: Record<string, unknown>; expectedImprovement: number }
    ): Promise<{ improved: StructuredStrategy; notes: string }> {
      
      // Fetch past backtests to compare performance
      let pastPerformanceContext = "";
      if (strategyId) {
        const { data: pastBacktests } = await supabaseAdmin
          .from("strategy_backtests")
          .select("strategy_version, total_trades, win_rate, net_pnl_percentage, created_at")
          .eq("strategy_id", strategyId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (pastBacktests && pastBacktests.length > 0) {
          pastPerformanceContext = "\nPAST IMPROVEMENT HISTORY:\n" + pastBacktests.map(pb => 
            `- v${pb.strategy_version}: Win Rate ${pb.win_rate.toFixed(1)}%, P&L ${pb.net_pnl_percentage.toFixed(2)}%, Trades: ${pb.total_trades} (${new Date(pb.created_at).toLocaleDateString()})`
          ).join("\n");
        }
      }

      // AI Trading Engine Learnings Context
      let aiEngineContext = "";
      if (aiEngineSuggestions && aiEngineSuggestions.suggestions.length > 0) {
        aiEngineContext = `

🤖 AI TRADING ENGINE LEARNINGS (From Historical Trade Analysis):
${aiEngineSuggestions.suggestions.map(s => `- ${s}`).join("\n")}
${aiEngineSuggestions.optimizedParams ? `
Suggested Parameter Changes:
- Stop Loss: ${aiEngineSuggestions.optimizedParams.stop_loss_pct || "No change"}%
- Target: ${aiEngineSuggestions.optimizedParams.target_pct || "No change"}%
- Trailing Stop: ${aiEngineSuggestions.optimizedParams.trailing_stop ? "Enable" : "No change"}
- Additional Filter: ${aiEngineSuggestions.optimizedParams.additional_filter || "None"}
` : ""}
Expected Improvement: ${aiEngineSuggestions.expectedImprovement}%
CRITICAL: Incorporate these learnings into your improvements. The AI Engine has analyzed real trade outcomes to provide these insights.
`;
      }

      // Analyze trade patterns
      const trades = backtestResults.trade_log || [];
      const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
      const losingTrades = trades.filter(t => (t.pnl || 0) <= 0);
      
      // Calculate trade statistics
      const avgWin = winningTrades.length > 0 
        ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length 
        : 0;
      const avgLoss = losingTrades.length > 0 
        ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length)
        : 0;
      const avgHoldingPeriod = trades.length > 0
        ? trades.reduce((sum, t) => {
            if (t.entry_time && t.exit_time) {
              return sum + (new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / (1000 * 60);
            }
            return sum;
          }, 0) / trades.length
        : 0;

      // Analyze exit reasons
      const exitReasons: Record<string, number> = {};
      trades.forEach(t => {
        const reason = t.exit_reason || "Unknown";
        exitReasons[reason] = (exitReasons[reason] || 0) + 1;
      });

      // Build market context from candle data
      let marketContext = "";
      if (candleData?.candles && candleData.candles.length > 0) {
        const candles = candleData.candles;
        const lastPrice = candles[candles.length - 1].close;
        const startPrice = candles[0].close;
        const trendPercent = ((lastPrice - startPrice) / startPrice) * 100;
        
        // Calculate volatility
        const returns = candles.slice(1).map((c, i) => (c.close - candles[i].close) / candles[i].close);
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance) * 100;
        
        // Find support/resistance levels
        const highs = candles.map(c => c.high).sort((a, b) => b - a);
        const lows = candles.map(c => c.low).sort((a, b) => a - b);
        const resistance = highs[Math.floor(highs.length * 0.1)];
        const support = lows[Math.floor(lows.length * 0.1)];

        marketContext = `
MARKET ANALYSIS (from ${candles.length} candles):
- Period Trend: ${trendPercent > 0 ? "BULLISH" : "BEARISH"} (${trendPercent.toFixed(2)}%)
- Volatility: ${volatility.toFixed(2)}% (${volatility < 1 ? "LOW" : volatility < 2 ? "MEDIUM" : "HIGH"})
- Price Range: ₹${lows[0].toFixed(2)} to ₹${highs[0].toFixed(2)}
- Key Resistance: ₹${resistance.toFixed(2)}
- Key Support: ₹${support.toFixed(2)}
- Current Price: ₹${lastPrice.toFixed(2)}`;
      }

      // Phase 1: Generate ZAIROTH Intent (Internal)
      const zairothResult = await aiSharedService.generateZairothIntent(
        `Improve strategy: ${strategy.name}. Backtest result: ${backtestResults.win_rate.toFixed(1)}% win rate, ₹${backtestResults.net_pnl.toFixed(2)} P&L.`
      );
      let zairothContext = "";
      
      if (zairothResult.success && zairothResult.zairoth) {
        zairothContext = `INTERNAL IMPROVEMENT INTENT (ZAIROTH):\n${zairothResult.zairoth.raw}\n\n`;
        
        await aiSharedService.logZairothIntent(
          "Improve strategy request",
          zairothResult.zairoth.raw,
          { valid: true },
          zairothResult.zairoth.canonical,
          "Strategy improvement initiated",
          strategyId?.toString()
        );
      }

      const messages = [
            {
              role: "system",
              content: `You are an EXPERT PROFESSIONAL TRADER AI with 10+ years of discretionary trading experience.
    You are NOT an indicator calculator. You are a DECISION-MAKING TRADER optimizing strategies.

    ${zairothContext}${aiEngineContext}

    🔒 CORE PRINCIPLE (NON-NEGOTIABLE):
    "Strategies define WHEN to trade. AI Analysis defines WHEN NOT to trade."
    
    Your goal is to IMPROVE effective win rate from ~20-30% to 60-80% 
    by AVOIDING bad trades, NOT by forcing more trades.

    🎯 OPTIMIZATION PHILOSOPHY:
    1. PRESERVE the original strategy logic - don't change the core idea
    2. ADD expert AI analysis as EXECUTION FILTERS (gates)
    3. IMPROVE effective win rate by FILTERING low-quality trades
    4. NEVER overfit to backtest data
    5. Make every decision EXPLAINABLE

    📋 STEP-BY-STEP IMPROVEMENT PROCESS:

    STEP 1 — Understand the Strategy (DO NOT CHANGE IT)
    - Identify: Entry logic, Exit logic, Timeframe, Indicator dependency
    - Assume the strategy logic is CORRECT but INCOMPLETE
    - DO NOT optimize parameters yet

    STEP 2 — Analyze Historical Weaknesses (Trader Mindset)
    Based on the strategy type, identify:
    - Where it usually fails
    - Typical loss scenarios
    - Market conditions where it underperforms
    Examples:
    - RSI strategies fail in STRONG TRENDS
    - Breakouts fail in LOW VOLATILITY
    - Mean reversion fails during NEWS EVENTS

    STEP 3 — Add AI ANALYSIS FILTERS (THIS IS THE EDGE)
    Add gates that evaluate:
    
    🔹 Market Regime:
    - Trending / Ranging / High volatility / Low liquidity
    - ADX > 25 = Trending (good for momentum)
    - ADX < 20 = Ranging (avoid breakouts)
    
    🔹 Trade Quality:
    - Momentum strength (RSI slope, MACD histogram)
    - Volatility expansion vs contraction
    - Proximity to key levels (VWAP, Day High/Low)
    
    🔹 Risk Conditions:
    - Sudden volatility spikes
    - News-like behavior
    - Overextended candles (>2x ATR)

    STEP 4 — Combine Strategy + AI Analysis
    For EVERY entry, produce:
    - Strategy Rule (original logic)
    - AI Analysis Gate (expert judgment)
    - Execution Decision (allowed / blocked)
    - Reason (human-readable)

    AI Analysis must:
    - BLOCK bad trades
    - NOT force trades
    - Reduce frequency, INCREASE quality

    STEP 5 — Risk & Loss Control
    Explicitly decide:
    - When to SKIP a trade even if signal exists
    - When to cut loss EARLY
    - When to avoid RE-ENTRY
    Rules: Protect capital > maximize profit

    🚫 WHAT YOU MUST NEVER DO:
    - ❌ Inflate win rate by curve fitting
    - ❌ Add 10 indicators to feel safe
    - ❌ Optimize for backtest only
    - ❌ Remove all losses (unrealistic)
    - ❌ Hide why a trade is blocked

    KEY PHILOSOPHY:
    "A good trader does not trade often. A good trader trades WELL-SELECTED moments."
    "The edge is not in the strategy. The edge is in TRADE SELECTION."
    "Losses are normal. BAD losses are not."
  
    ### AVAILABLE INDICATORS:
    | Indicator | Periods | Entry Signal |
    |-----------|---------|--------------|
    | RSI | 7, 14, 21 | <35 oversold (buy), >65 overbought (sell) |
    | EMA | 9, 20, 50, 200 | Price crossover, EMA crossover |
    | SMA | 20, 50, 200 | Trend direction |
    | MACD | 12,26,9 | Signal line cross, histogram reversal |
    | SUPERTREND | 10,3 | Direction change |
    | ADX | 14 | >25 = trending (take trades), <20 = ranging (SKIP) |
    | BB | 20,2 | Band squeeze breakout |
    | ATR | 14 | Volatility measurement, stop loss sizing |
    
    ### RULE STRUCTURE:
    \`\`\`json
    { "type": "indicator", "name": "RSI", "period": 14, "operator": "<", "value": 35 }
    { "type": "price_vs_indicator", "priceField": "close", "operator": "CROSS_ABOVE", "indicator": "EMA", "indicatorPeriod": 20 }
    { "type": "indicator_vs_indicator", "indicator1": "EMA", "period1": 9, "indicator2": "EMA", "period2": 21, "operator": "CROSS_ABOVE" }
    { "type": "trend", "indicator": "SUPERTREND", "direction": "BULLISH" }
    { "type": "trend", "indicator": "ADX", "operator": ">", "value": 25 }
    \`\`\`
    
    ### OUTPUT FORMAT:
    {
      "improved": {
        "name": "Strategy Name vX",
        "description": "Improved with AI Analysis Gates: [list key changes]",
        "strategy_type": "INTRADAY" | "SWING",
        "buy_entry_logic": { "conditions": [...], "indicators": [...] },
        "sell_entry_logic": { "conditions": [...], "indicators": [...] },
        "buy_stop_loss": { "parameters": { "percentage": X } },
        "buy_target": { "parameters": { "percentage": Y } },
        "sell_stop_loss": { "parameters": { "percentage": X } },
        "sell_target": { "parameters": { "percentage": Y } },
        "buy_trailing_sl": { "conditions": [] },
        "sell_trailing_sl": { "conditions": [] },
        "hold_logic": { "conditions": [] },
        "ai_analysis_layer": {
          "market_regime_check": "ADX > 25 required for trend trades",
          "trade_quality_check": "RSI not in neutral zone (40-60)",
          "risk_avoidance": "Skip if candle > 2x ATR"
        },
        "executable_strategy": {
          "name": "...",
          "strategyType": "...",
          "version": X,
          "buy": { "logic": "OR"|"AND", "rules": [...] },
          "sell": { "logic": "OR"|"AND", "rules": [...] },
          "buyExit": { "stopLoss": {...}, "target": {...} },
          "sellExit": { "stopLoss": {...}, "target": {...} },
          "requiredIndicators": [...],
          "minWarmupCandles": 30
        }
      },
      "notes": "SECTION 1: Strategy preserved. SECTION 2: AI Analysis Gates added - [list]. SECTION 3: Expected improvement - fewer trades, higher win rate."
    }`,
          },
          {
            role: "user",
            content: `Analyze and improve this trading strategy using EXPERT AI TRADER methodology.

    CURRENT STRATEGY (SECTION 1 - DO NOT CHANGE CORE LOGIC):
    Name: ${strategy.name}
    Type: ${strategy.strategy_type || "SWING"}
    Buy Conditions: ${JSON.stringify(strategy.buy_entry_logic?.conditions || [])}
    Sell Conditions: ${JSON.stringify(strategy.sell_entry_logic?.conditions || [])}
    Stop Loss: ${strategy.buy_stop_loss?.parameters?.percentage || 2}%
    Target: ${strategy.buy_target?.parameters?.percentage || 4}%
    
    BACKTEST PERFORMANCE (SECTION 2 - AI ANALYSIS NEEDED):
    - Total Trades: ${backtestResults.total_trades}
    - Win Rate: ${backtestResults.win_rate.toFixed(1)}% (${winningTrades.length} wins, ${losingTrades.length} losses)
    - Net P&L: ₹${backtestResults.net_pnl.toFixed(2)} (${backtestResults.net_pnl_percentage.toFixed(2)}%)
    - Max Drawdown: ${backtestResults.max_drawdown_percentage.toFixed(2)}%
    - Avg Win: ₹${avgWin.toFixed(2)}
    - Avg Loss: ₹${avgLoss.toFixed(2)}
    - Risk/Reward Ratio: ${avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "N/A"}
    - Avg Holding Period: ${avgHoldingPeriod.toFixed(0)} minutes
    
    EXIT REASON BREAKDOWN:
    ${Object.entries(exitReasons).map(([reason, count]) => `- ${reason}: ${count} trades (${((count/trades.length)*100).toFixed(1)}%)`).join('\n')}
    ${marketContext}
    ${pastPerformanceContext}
    
    SAMPLE LOSING TRADES (to understand weaknesses):
    ${JSON.stringify(losingTrades.slice(-3).map(t => ({
      type: t.type,
      entry: t.entry_price,
      exit: t.exit_price,
      pnl: t.pnl?.toFixed(2),
      reason: t.exit_reason
    })), null, 2)}

    SAMPLE WINNING TRADES (to understand strengths):
    ${JSON.stringify(winningTrades.slice(-3).map(t => ({
      type: t.type,
      entry: t.entry_price,
      exit: t.exit_price,
      pnl: t.pnl?.toFixed(2),
      reason: t.exit_reason
    })), null, 2)}
    
    EXECUTABLE STRATEGY RULES:
    ${JSON.stringify(strategy.executable_strategy, null, 2)}
    
    Based on this analysis, create an IMPROVED strategy that:
    1. PRESERVES the original strategy logic
    2. ADDS AI Analysis Gates to FILTER out bad trades
    3. REDUCES trade frequency but INCREASES win rate
    4. Targets 60-80% effective win rate through TRADE SELECTION
    5. Makes every decision EXPLAINABLE`,
          },
        ];
  
      const result = await aiSharedService.executeAnalysis("strategy_improve", messages, {
        maxTokens: 4000,
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
        
        const ensureFields = (obj: any) => {
          if (!obj || typeof obj !== "object") return { 
            name: strategy.name + " (Improved)", 
            description: strategy.description,
            strategy_type: strategy.strategy_type || "SWING"
          };
          const fields = [
            "buy_entry_logic", "buy_stop_loss", "buy_target", "buy_trailing_sl",
            "sell_entry_logic", "sell_stop_loss", "sell_target", "sell_trailing_sl",
            "hold_logic"
          ];
          fields.forEach(field => {
            if (!obj[field] || typeof obj[field] !== "object") {
              obj[field] = { conditions: [], parameters: {} };
            }
            if (!obj[field].conditions || !Array.isArray(obj[field].conditions)) {
              obj[field].conditions = [];
            }
            if (!obj[field].parameters || typeof obj[field].parameters !== "object" || obj[field].parameters === null) {
              obj[field].parameters = {};
            }
          });
          if (!obj.name) obj.name = strategy.name + " (Improved)";
          if (!obj.description) obj.description = strategy.description;
          if (!obj.strategy_type) obj.strategy_type = strategy.strategy_type || "SWING";
          
          // Ensure executable_strategy is valid
          if (obj.executable_strategy && typeof obj.executable_strategy === "object") {
            obj.executable_strategy = this.sanitizeExecutableStrategy(obj.executable_strategy);
          } else {
            obj.executable_strategy = this.createFallbackExecutableStrategy(obj);
          }
          
          return obj;
        };
  
          if (parsed.improved) {
            const improved = this.syncConditionsWithExecutable(ensureFields(parsed.improved));
            const notes = parsed.notes || "Strategy optimized based on backtest analysis.";
            return { improved, notes };
          } else if (parsed.name) {
            const improved = this.syncConditionsWithExecutable(ensureFields(parsed));
            const notes = parsed.notes || "Strategy optimized based on backtest analysis.";
            return { improved, notes };
          }
    
          if (parsed.improved) return parsed;
          return { improved: ensureFields(parsed), notes: "Strategy optimized." };
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

    // Sanitize strategy before running backtest
    if (strategy.executable_strategy) {
      strategy.executable_strategy = this.sanitizeExecutableStrategy(strategy.executable_strategy);
    }

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
      strategy: StructuredStrategy & { zairoth_intent?: string },
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
          zairoth_intent: strategy.zairoth_intent || null,
          selected_timeframes: selectedTimeframes,
          selected_instruments: selectedInstruments,
          is_paper_trading: isPaperTrading,
          ai_analysis_enabled: strategy.ai_analysis_enabled || false,
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
        .select(`
          id, name, description, raw_input, visibility, is_active,
          buy_entry_logic, buy_stop_loss, buy_target, buy_trailing_sl,
          sell_entry_logic, sell_stop_loss, sell_target, sell_trailing_sl,
          hold_logic, executable_strategy, selected_timeframes,
          selected_instruments, is_paper_trading, is_finalized,
          status, version, improvement_count, admin_approved,
          created_at, updated_at
        `)
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
