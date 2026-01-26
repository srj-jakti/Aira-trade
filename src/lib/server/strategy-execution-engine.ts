import { supabaseAdmin } from "@/lib/supabase/admin";
import { type Candle } from "./indicator-calculator";
import { StrategyEvaluator } from "./strategy-evaluator";
import { processZairoth, evaluateSafety } from "@/lib/zairoth";
import { brainAuditLogger } from "./brain-audit-logger";

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
      if (strategy.zairoth_intent) {
        try {
          const zairoth = processZairoth(strategy.zairoth_intent);
          
          const { data: userCapital } = await supabaseAdmin
            .from("trading_preferences")
            .select("capital_used_percentage")
            .eq("user_id", strategy.user_id)
            .single();

          const safetyContext = {
            capitalUsed: userCapital?.capital_used_percentage || 0,
            volatility: "medium"
          };

          const safety = evaluateSafety(zairoth.instructions, safetyContext);
          
          await brainAuditLogger.logSafetyCheck({
            userId: strategy.user_id,
            zairothIntent: strategy.zairoth_intent,
            context: safetyContext,
            result: safety,
            sourceModule: "StrategyExecutionEngine",
          });
          
          if (safety.stop) {
            console.warn(`[ZAIROTH SAFETY] Kill-switch triggered for ${strategy.name}: ${safety.reason}`);
            await supabaseAdmin.from("audit_logs").insert({
              action: "STRATEGY_SAFETY_STOP",
              entity_type: "strategy",
              entity_id: strategy.id,
              user_id: strategy.user_id,
              details: { reason: safety.reason, intent: strategy.zairoth_intent }
            });
            
            await supabaseAdmin.from("brain_events").insert({
              event_type: "EXECUTION_BLOCKED",
              details: {
                strategyId: strategy.id,
                strategyName: strategy.name,
                userId: strategy.user_id,
                reason: safety.reason,
              },
              created_at: new Date().toISOString(),
            });
            
            return;
          }
        } catch (e) {
          console.error(`[ZAIROTH] Safety evaluation failed for ${strategy.name}`, e);
        }
      }

      const instrumentTokens = strategy.selected_instruments || [];

    if (instrumentTokens.length === 0) return;

    const { data: preferences } = await supabaseAdmin
      .from("trading_preferences")
      .select("auto_trading_enabled")
      .eq("user_id", strategy.user_id)
      .single();

    const isAutoTrading = preferences?.auto_trading_enabled || false;

    for (const token of instrumentTokens) {
      const timeframe = strategy.selected_timeframes?.[0] || "5m";
      
      // Fetch recent candles
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
      const indicatorData = StrategyEvaluator.precalculateIndicators(sortedCandles);
      const evaluation = StrategyEvaluator.evaluate(strategy, sortedCandles, lastIndex, indicatorData);

      let signal: "BUY" | "SELL" | null = null;
      if (evaluation.buySignal) signal = "BUY";
      else if (evaluation.sellSignal) signal = "SELL";

      if (signal) {
        await this.recordSignal(strategy.id, token, signal, sortedCandles[lastIndex].close);
        
        // ONLY trade if Auto Trading is enabled
        if (isAutoTrading) {
          if (strategy.is_paper_trading) {
            // Real-time Paper Trading
            await this.processPaperTrade(strategy, token, signal, sortedCandles[lastIndex]);
          } else {
            // REAL LIVE Trading
            await this.executeRealTrade(strategy, token, signal, sortedCandles[lastIndex]);
          }
        }
      } else {
        // Even if no new entry signal, check if we need to close existing paper trades based on logic
        if (strategy.is_paper_trading && isAutoTrading) {
          await this.processPaperTrade(strategy, token, null, sortedCandles[lastIndex], evaluation);
        }
      }
    }
  }

  private async executeRealTrade(strategy: any, token: number, signal: string, candle: any) {
    console.log(`[StrategyExecutionEngine] EXECUTING REAL TRADE: ${strategy.name} ${signal} ${token} @ ${candle.close}`);
    // Real trade execution would be integrated here
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

  private async processPaperTrade(
    strategy: any, 
    token: number, 
    signal: "BUY" | "SELL" | null, 
    candle: Candle,
    evaluation?: any
  ) {
    const { data: openTrade } = await supabaseAdmin
      .from("paper_trades")
      .select("*")
      .eq("strategy_id", strategy.id)
      .eq("instrument_token", token)
      .eq("status", "OPEN")
      .single();

    if (openTrade) {
      let shouldExit = false;
      let reason = "";

      // 1. Logic-based Exit
      if (openTrade.type === "BUY") {
        if (signal === "SELL" || (evaluation && evaluation.sellSignal)) {
          shouldExit = true;
          reason = "Exit Signal (Live Paper)";
        }
      } else {
        if (signal === "BUY" || (evaluation && evaluation.buySignal)) {
          shouldExit = true;
          reason = "Exit Signal (Live Paper)";
        }
      }

      // 2. SL/Target based Exit
      const entryPrice = openTrade.entry_price;
      const currentPrice = candle.close;
      
      if (openTrade.type === "BUY") {
        const slPct = strategy.buy_stop_loss?.parameters?.percentage || 2;
        const targetPct = strategy.buy_target?.parameters?.percentage || 4;
        
        if (currentPrice <= entryPrice * (1 - slPct / 100)) {
          shouldExit = true;
          reason = "Stop Loss Hit (Live Paper)";
        } else if (currentPrice >= entryPrice * (1 + targetPct / 100)) {
          shouldExit = true;
          reason = "Target Hit (Live Paper)";
        }
      } else {
        const slPct = strategy.sell_stop_loss?.parameters?.percentage || 2;
        const targetPct = strategy.sell_target?.parameters?.percentage || 4;
        
        if (currentPrice >= entryPrice * (1 + slPct / 100)) {
          shouldExit = true;
          reason = "Stop Loss Hit (Live Paper)";
        } else if (currentPrice <= entryPrice * (1 - targetPct / 100)) {
          shouldExit = true;
          reason = "Target Hit (Live Paper)";
        }
      }

      if (shouldExit) {
        const pnl = (currentPrice - entryPrice) * openTrade.quantity * (openTrade.type === "BUY" ? 1 : -1);
        const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100 * (openTrade.type === "BUY" ? 1 : -1);
        
        await supabaseAdmin
          .from("paper_trades")
          .update({
            status: "CLOSED",
            exit_price: currentPrice,
            exit_time: candle.timestamp,
            pnl,
            pnl_percentage: pnlPct,
            exit_reason: reason
          })
          .eq("id", openTrade.id);
      }
    } else if (signal) {
      // Open new paper trade
      await supabaseAdmin.from("paper_trades").insert({
        strategy_id: strategy.id,
        user_id: strategy.user_id,
        instrument_token: token,
        type: signal,
        entry_price: candle.close,
        entry_time: candle.timestamp,
        quantity: 1, // Simple default
        status: "OPEN"
      });
    }
  }
}

export const strategyExecutionEngine = StrategyExecutionEngine.getInstance();
