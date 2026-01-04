import { supabaseAdmin } from "@/lib/supabase/admin";
import { IndicatorCalculator, type Candle } from "./indicator-calculator";
import { type StructuredStrategy } from "./strategy-service";

export class StrategyExecutionEngine {
  private static instance: StrategyExecutionEngine;
  private interval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): StrategyExecutionEngine {
    if (!StrategyExecutionEngine.instance) {
      StrategyExecutionEngine.instance = new StrategyExecutionEngine();
    }
    return StrategyExecutionEngine.instance;
  }

  async start() {
    if (this.interval) return;
    
    // Check active strategies every 1 minute
    this.interval = setInterval(() => this.processActiveStrategies(), 60 * 1000);
    console.log("[StrategyExecutionEngine] Started");
  }

  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async processActiveStrategies() {
    try {
      const { data: strategies, error } = await supabaseAdmin
        .from("strategies")
        .select("*")
        .eq("is_active", true);

      if (error || !strategies) return;

      for (const strategy of strategies) {
        await this.evaluateStrategy(strategy);
      }
    } catch (error) {
      console.error("[StrategyExecutionEngine] Error processing strategies:", error);
    }
  }

  private async evaluateStrategy(strategy: any) {
    const instrumentTokens = strategy.selected_instruments || [];
    if (instrumentTokens.length === 0) return;

    for (const token of instrumentTokens) {
      const timeframe = strategy.selected_timeframes?.[0] || "5m";
      
      // Fetch recent candles (need enough for indicators)
      const { data: candles } = await supabaseAdmin
        .from("live_candles")
        .select("*")
        .eq("instrument_token", token)
        .eq("timeframe", timeframe)
        .order("timestamp", { ascending: false })
        .limit(100);

      if (!candles || candles.length < 50) continue;

      const sortedCandles = candles.reverse().map(c => ({
        timestamp: c.timestamp,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseInt(c.volume)
      }));

      const lastIndex = sortedCandles.length - 1;
      const signal = this.checkSignals(strategy, sortedCandles, lastIndex);

      if (signal) {
        await this.recordSignal(strategy.id, token, signal, sortedCandles[lastIndex].close);
        
        if (strategy.is_paper_trading) {
          await this.processPaperTrade(strategy, token, signal, sortedCandles[lastIndex]);
        }
      }
    }
  }

  private checkSignals(strategy: StructuredStrategy, candles: Candle[], index: number): "BUY" | "SELL" | null {
    const checkAllConditions = (conditions: string[], idx: number): boolean => {
      if (!conditions || conditions.length === 0) return false;
      
      // Re-using the logic from StrategyService but simplified for real-time
      // Ideally, we should unify this into a shared Evaluator class
      // For now, I'll implement a basic version that handles common indicators
      
      const closePrices = candles.map(c => c.close);
      const indicatorData: Record<string, any> = {};
      
      return conditions.every(condition => {
        const lowerCond = condition.toLowerCase();
        
        if (lowerCond.includes("rsi")) {
          const rsi = IndicatorCalculator.calculateRSI(closePrices, 14)[idx];
          if (isNaN(rsi)) return false;
          if (lowerCond.includes("below") || lowerCond.includes("<")) return rsi < 30;
          if (lowerCond.includes("above") || lowerCond.includes(">")) return rsi > 70;
        }

        if (lowerCond.includes("sma") || lowerCond.includes("ema")) {
          const period = 20; // Default
          const ma = lowerCond.includes("sma") 
            ? IndicatorCalculator.calculateSMA(closePrices, period)[idx]
            : IndicatorCalculator.calculateEMA(closePrices, period)[idx];
          if (isNaN(ma)) return false;
          if (lowerCond.includes("above")) return candles[idx].close > ma;
          if (lowerCond.includes("below")) return candles[idx].close < ma;
        }

        return false;
      });
    };

    if (checkAllConditions(strategy.buy_entry_logic.conditions, index)) return "BUY";
    if (checkAllConditions(strategy.sell_entry_logic.conditions, index)) return "SELL";
    
    return null;
  }

  private async recordSignal(strategyId: number, token: number, type: string, price: number) {
    await supabaseAdmin.from("strategy_signals").insert({
      strategy_id: strategyId,
      instrument_token: token,
      type,
      price,
      metadata: { source: "execution_engine" }
    });
  }

  private async processPaperTrade(strategy: any, token: number, signal: string, candle: Candle) {
    // Check if we already have an open paper trade for this strategy/instrument
    const { data: openTrade } = await supabaseAdmin
      .from("paper_trades")
      .select("*")
      .eq("strategy_id", strategy.id)
      .eq("instrument_token", token)
      .eq("status", "OPEN")
      .single();

    if (openTrade) {
      // Check for exit signal or SL/Target
      let shouldExit = false;
      let reason = "";

      if (openTrade.type === "BUY" && signal === "SELL") {
        shouldExit = true;
        reason = "Reverse Signal";
      } else if (openTrade.type === "SELL" && signal === "BUY") {
        shouldExit = true;
        reason = "Reverse Signal";
      }

      // Check SL/Target (Basic)
      const pnlPct = openTrade.type === "BUY" 
        ? ((candle.close - openTrade.entry_price) / openTrade.entry_price) * 100
        : ((openTrade.entry_price - candle.close) / openTrade.entry_price) * 100;

      if (pnlPct <= -2) { shouldExit = true; reason = "Stop Loss Hit"; }
      if (pnlPct >= 4) { shouldExit = true; reason = "Target Hit"; }

      if (shouldExit) {
        const pnl = (candle.close - openTrade.entry_price) * openTrade.quantity * (openTrade.type === "BUY" ? 1 : -1);
        await supabaseAdmin
          .from("paper_trades")
          .update({
            status: "CLOSED",
            exit_price: candle.close,
            exit_time: candle.timestamp,
            pnl,
            pnl_percentage: pnlPct,
            exit_reason: reason
          })
          .eq("id", openTrade.id);
      }
    } else {
      // Open new paper trade
      await supabaseAdmin.from("paper_trades").insert({
        strategy_id: strategy.id,
        user_id: strategy.user_id,
        instrument_token: token,
        type: signal,
        entry_price: candle.close,
        entry_time: candle.timestamp,
        quantity: 1, // Default
        status: "OPEN"
      });
    }
  }
}

export const strategyExecutionEngine = StrategyExecutionEngine.getInstance();
