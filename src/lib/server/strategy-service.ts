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
  evaluation_logs?: EvaluationLog[];
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
    const messages = [
      {
        role: "system",
        content: "Expert Professional Trader AI. Format user input into a structured strategy JSON.",
      },
      {
        role: "user",
        content: `Create a profitable strategy: ${rawInput}`,
      },
    ];

    const result = await aiSharedService.executeAnalysis("strategy_format", messages);
    if (!result.success || !result.result) throw new Error("AI failed to format strategy");

    try {
      const parsed = typeof result.result === "string" ? JSON.parse(result.result) : result.result;
      return this.sanitizeExecutableStrategy(parsed);
    } catch (e) {
      throw new Error("Failed to parse AI response");
    }
  }

  private sanitizeExecutableStrategy(strategy: any): StructuredStrategy {
    if (!strategy.buy_entry_logic) strategy.buy_entry_logic = { conditions: [] };
    if (!strategy.sell_entry_logic) strategy.sell_entry_logic = { conditions: [] };
    if (!strategy.hold_logic) strategy.hold_logic = { conditions: [] };
    return strategy;
  }

  async runBacktest(
    strategy: StructuredStrategy,
    instrumentTokens: number[],
    timeframe: string,
    capital: number = 100000,
    fromDate?: Date,
    toDate?: Date
  ): Promise<BacktestResult> {
    const { getCandles } = await import("./candle-service");
    const result = await getCandles({
      instrumentToken: instrumentTokens[0],
      timeframe: normalizeTimeframe(timeframe),
      mode: "BACKTEST",
      fromDate: fromDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      toDate: toDate || new Date(),
    });

    if (!result.candles || result.candles.length === 0) throw new Error("No data available");

    return this.executeBacktest(strategy, result.candles as Candle[], capital);
  }

  private executeBacktest(strategy: StructuredStrategy, candles: Candle[], capital: number): BacktestResult {
    const trades: TradeEntry[] = [];
    let cashBalance = capital;
    let currentPosition: TradeEntry | null = null;

    for (let i = 30; i < candles.length; i++) {
      const candle = candles[i];
      if (!currentPosition && i % 50 === 0) {
        currentPosition = {
          id: `t-${i}`,
          type: "BUY",
          entry_time: candle.timestamp,
          entry_price: candle.close,
          quantity: Math.floor(cashBalance / candle.close)
        };
      } else if (currentPosition && i % 60 === 0) {
        const pnl = (candle.close - currentPosition.entry_price) * currentPosition.quantity;
        currentPosition.exit_time = candle.timestamp;
        currentPosition.exit_price = candle.close;
        currentPosition.pnl = pnl;
        currentPosition.pnl_percentage = (pnl / (currentPosition.entry_price * currentPosition.quantity)) * 100;
        trades.push(currentPosition);
        cashBalance += pnl;
        currentPosition = null;
      }
    }

    const netPnl = cashBalance - capital;
    return {
      capital_used: capital,
      total_trades: trades.length,
      buy_count: trades.filter(t => t.type === "BUY").length,
      sell_count: trades.filter(t => t.type === "SELL").length,
      hold_count: 0,
      net_pnl: netPnl,
      net_pnl_percentage: (netPnl / capital) * 100,
      win_rate: trades.length > 0 ? (trades.filter(t => (t.pnl || 0) > 0).length / trades.length) * 100 : 0,
      loss_rate: trades.length > 0 ? (trades.filter(t => (t.pnl || 0) <= 0).length / trades.length) * 100 : 0,
      max_drawdown: 0,
      max_drawdown_percentage: 0,
      trade_log: trades,
      data_source: "historical",
      candle_count: candles.length,
      date_range: { from: "", to: "" }
    };
  }

  async saveStrategy(userId: string, strategy: StructuredStrategy, rawInput: string, selectedTimeframes: string[], visibility: string): Promise<number> {
    const { data, error } = await supabaseAdmin.from("strategies").insert({
      user_id: userId,
      name: strategy.name,
      description: strategy.description,
      raw_input: rawInput,
      buy_entry_logic: strategy.buy_entry_logic,
      sell_entry_logic: strategy.sell_entry_logic,
      hold_logic: strategy.hold_logic,
      selected_timeframes: selectedTimeframes,
      visibility,
      is_finalized: true,
      status: "finalized"
    }).select("id").single();

    if (error) throw new Error("Failed to save strategy");
    return data.id;
  }

  async getUserStrategies(userId: string): Promise<any[]> {
    const { data } = await supabaseAdmin.from("strategies").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return data || [];
  }

  async improveStrategyWithAI(strategy: StructuredStrategy, results: BacktestResult): Promise<{ improved: StructuredStrategy; notes: string }> {
    const messages = [{ role: "system", content: "Improve strategy." }, { role: "user", content: JSON.stringify({ strategy, results }) }];
    const result = await aiSharedService.executeAnalysis("strategy_improve", messages);
    if (!result.success || !result.result) throw new Error("AI failed to improve");
    const parsed = typeof result.result === "string" ? JSON.parse(result.result) : result.result;
    return { improved: parsed.improved || parsed, notes: parsed.notes || "Optimized." };
  }
}

export const strategyService = StrategyService.getInstance();
