import { supabaseAdmin } from "@/lib/supabase/admin";
import { airaBrain } from "./aira-brain";

export interface TradeDecision {
  action: "ENTRY" | "EXIT" | "SKIP" | "HOLD";
  direction?: "LONG" | "SHORT";
  confidence: number;
  signalStrength: number;
  reasoning: string;
  riskRewardRatio: number;
  suggestedSize: number;
  stopLoss?: number;
  target?: number;
  trailingStop?: number;
}

export interface StrategyPerformance {
  strategyId: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  riskRewardRatio: number;
}

export interface ChartPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  reliability: number;
  targetMove: number;
}

export interface MarketContext {
  trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
  volatility: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  momentum: number;
  volume: "LOW" | "AVERAGE" | "HIGH";
  keyLevels: { support: number[]; resistance: number[] };
}

class AITradingEngine {
  private static instance: AITradingEngine;

  private constructor() {}

  static getInstance(): AITradingEngine {
    if (!AITradingEngine.instance) {
      AITradingEngine.instance = new AITradingEngine();
    }
    return AITradingEngine.instance;
  }

  async analyzeChartForStrategy(
    strategyId: number,
    candles: Array<{ open: number; high: number; low: number; close: number; volume: number; timestamp: Date }>,
    strategyRules: unknown,
    timeframe: string
  ): Promise<TradeDecision> {
    const performance = await this.getStrategyPerformance(strategyId);
    const learnings = await this.getStrategyLearnings(strategyId);
    const marketContext = this.analyzeMarketContext(candles);

    const recentCandles = candles.slice(-50);
    const candlesData = recentCandles.map(c => ({
      o: c.open.toFixed(2),
      h: c.high.toFixed(2),
      l: c.low.toFixed(2),
      c: c.close.toFixed(2),
      v: c.volume
    }));

    const systemPrompt = `You are the CORE AI TRADING ENGINE - a high-performance, self-learning quant machine.
    Your mission: MAXIMIZE WIN-RATE and REWARD-TO-RISK.

    🎯 STRATEGIC MANDATE:
    1. WIN BIG: When a setup is high-conviction, maximize the target and use aggressive trailing stops.
    2. LOSE SMALL: Cut losses instantly if the thesis is invalidated. Tighten stops in high volatility.
    3. FILTER NOISE: You are a VETO engine. Your primary job is to SKIP mediocre trades. 
    4. EVOLVE: Use the "Learnings" below to avoid repeating past mistakes.

    📊 PERFORMANCE CONTEXT:
    ${performance ? `
    - Strategy Grade: ${performance.profitFactor > 1.5 ? 'A' : performance.profitFactor > 1.1 ? 'B' : 'C'}
    - Win Rate: ${(performance.winRate * 100).toFixed(1)}%
    - Avg Win/Loss Ratio: ${(performance.avgWin / (performance.avgLoss || 1)).toFixed(2)}
    - Profit Factor: ${performance.profitFactor.toFixed(2)}
    - Drawdown: ${(performance.maxDrawdown * 100).toFixed(1)}%
    ` : 'New strategy - initialize with high selectivity.'}

    🧠 BRAIN MEMORY (Learnings from previous trades):
    ${learnings.length > 0 ? learnings.map(l => `[VETO CRITERIA] ${l}`).join('\n') : 'No specific vetos yet. Look for standard traps (liquidity sweeps, fakeouts).'}

    📈 MARKET REGIME:
    - Trend: ${marketContext.trend} (${marketContext.momentum > 0 ? 'Strong' : 'Weak'})
    - Volatility: ${marketContext.volatility}
    - Volume: ${marketContext.volume}
    - Critical Levels: S: ${marketContext.keyLevels.support.slice(0, 2).join(', ')} | R: ${marketContext.keyLevels.resistance.slice(0, 2).join(', ')}

    📋 STRATEGY RULES:
    ${JSON.stringify(strategyRules, null, 2)}

    🔐 EXECUTION PROTOCOL:
    - CONFIDENCE < 75%: SKIP (The "Monkey" trades everything; the "Machine" trades only the best).
    - RR RATIO < 1:2: SKIP (Unless it's a high-probability scalp with >85% confidence).
    - SL PLACEMENT: Must be below/above recent structure + buffer.
    - TP PLACEMENT: Must be at/before major liquidity zones.

    OUTPUT FORMAT (JSON):
    {
      "action": "ENTRY|EXIT|SKIP|HOLD",
      "direction": "LONG|SHORT",
      "confidence": 0-100,
      "reasoning": "Detailed technical justification why this trade will WIN BIG or why it's being SKIPPED",
      "riskRewardRatio": number,
      "stopLoss": price,
      "target": price,
      "suggestedSize": 0.1-1.0,
      "trailingStop": price or null
    }`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this ${timeframe} chart data and decide: ${JSON.stringify(candlesData)}` }
    ];

    const result = await airaBrain.executeAnalysis("ai_trading_decision", messages, {
      maxTokens: 800,
      skipCache: true
    });

    if (result.success && result.result) {
      try {
        const parsed = typeof result.result === 'string' 
          ? JSON.parse(result.result.replace(/```json\n?|\n?```/g, ''))
          : result.result;

        await this.logDecision(strategyId, parsed, marketContext, candlesData);

        return {
          action: parsed.action || "SKIP",
          direction: parsed.direction,
          confidence: parsed.confidence || 0,
          signalStrength: parsed.signalStrength || 0,
          reasoning: parsed.reasoning || "No reasoning provided",
          riskRewardRatio: parsed.riskRewardRatio || 2,
          suggestedSize: parsed.suggestedSize || 0.5,
          stopLoss: parsed.stopLoss,
          target: parsed.target,
          trailingStop: parsed.trailingStop
        };
      } catch {
        return this.getDefaultSkipDecision("Failed to parse AI response");
      }
    }

    return this.getDefaultSkipDecision("AI analysis failed");
  }

  private getDefaultSkipDecision(reason: string): TradeDecision {
    return {
      action: "SKIP",
      confidence: 0,
      signalStrength: 0,
      reasoning: reason,
      riskRewardRatio: 0,
      suggestedSize: 0
    };
  }

  private analyzeMarketContext(candles: Array<{ open: number; high: number; low: number; close: number; volume: number }>): MarketContext {
    if (candles.length < 20) {
      return {
        trend: "SIDEWAYS",
        volatility: "NORMAL",
        momentum: 0,
        volume: "AVERAGE",
        keyLevels: { support: [], resistance: [] }
      };
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentPrice = closes[closes.length - 1];
    
    let trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS" = "SIDEWAYS";
    if (currentPrice > sma20 * 1.02) trend = "UPTREND";
    else if (currentPrice < sma20 * 0.98) trend = "DOWNTREND";

    const recentCloses = closes.slice(-20);
    const returns = recentCloses.slice(1).map((c, i) => (c - recentCloses[i]) / recentCloses[i]);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    let volatility: "LOW" | "NORMAL" | "HIGH" | "EXTREME" = "NORMAL";
    if (stdDev < 0.005) volatility = "LOW";
    else if (stdDev > 0.02) volatility = "EXTREME";
    else if (stdDev > 0.01) volatility = "HIGH";

    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    let volume: "LOW" | "AVERAGE" | "HIGH" = "AVERAGE";
    if (currentVolume < avgVolume * 0.7) volume = "LOW";
    else if (currentVolume > avgVolume * 1.5) volume = "HIGH";

    const momentum = ((currentPrice - closes[closes.length - 14]) / closes[closes.length - 14]) * 100;

    const recentLows = lows.slice(-50).sort((a, b) => a - b);
    const recentHighs = highs.slice(-50).sort((a, b) => b - a);
    
    return {
      trend,
      volatility,
      momentum,
      volume,
      keyLevels: {
        support: recentLows.slice(0, 5),
        resistance: recentHighs.slice(0, 5)
      }
    };
  }

  async getStrategyPerformance(strategyId: number): Promise<StrategyPerformance | null> {
    const { data } = await supabaseAdmin
      .from("strategy_performance_metrics")
      .select("*")
      .eq("strategy_id", strategyId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!data?.[0]) return null;

    const m = data[0];
    return {
      strategyId: m.strategy_id,
      winRate: m.win_rate || 0,
      avgWin: m.avg_win || 0,
      avgLoss: m.avg_loss || 0,
      profitFactor: m.profit_factor || 0,
      maxDrawdown: m.max_drawdown || 0,
      sharpeRatio: m.sharpe_ratio || 0,
      totalTrades: m.total_trades || 0,
      riskRewardRatio: m.risk_reward_ratio || 0
    };
  }

  async getStrategyLearnings(strategyId: number): Promise<string[]> {
    const { data: decisions } = await supabaseAdmin
      .from("ai_trading_decisions")
      .select("*")
      .eq("strategy_id", strategyId)
      .not("was_correct", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!decisions?.length) return [];

    const learnings: string[] = [];
    
    const correctDecisions = decisions.filter(d => d.was_correct);
    const wrongDecisions = decisions.filter(d => !d.was_correct);

    if (correctDecisions.length > wrongDecisions.length * 2) {
      learnings.push("Strategy is performing well - maintain current approach");
    } else if (wrongDecisions.length > correctDecisions.length * 1.5) {
      learnings.push("Strategy underperforming - increase selectivity, wait for higher confidence setups");
    }

    const skipDecisions = decisions.filter(d => d.decision_type === 'skip');
    const entryDecisions = decisions.filter(d => d.decision_type === 'entry');
    if (skipDecisions.length < entryDecisions.length * 0.5) {
      learnings.push("Consider skipping more trades - quality over quantity");
    }

    const bigLosses = wrongDecisions.filter(d => d.pnl_result && d.pnl_result < -2);
    if (bigLosses.length > 3) {
      learnings.push("Multiple large losses detected - tighten stop losses");
    }

    const smallWins = correctDecisions.filter(d => d.pnl_result && d.pnl_result < 1);
    if (smallWins.length > correctDecisions.length * 0.5) {
      learnings.push("Cutting winners too early - consider trailing stops");
    }

    return learnings;
  }

  private async logDecision(
    strategyId: number,
    decision: TradeDecision,
    marketContext: MarketContext,
    candles: unknown
  ): Promise<void> {
    try {
      await supabaseAdmin.from("ai_trading_decisions").insert({
        strategy_id: strategyId,
        decision_type: decision.action.toLowerCase(),
        signal_strength: decision.signalStrength,
        confidence: decision.confidence,
        market_context: marketContext,
        technical_indicators: { candles_analyzed: 50 },
        ai_reasoning: decision.reasoning
      });
    } catch (error) {
      console.error("[AITradingEngine] Failed to log decision:", error);
    }
  }

  async recordTradeOutcome(
    decisionId: number,
    outcome: "win" | "loss" | "breakeven",
    pnl: number
  ): Promise<void> {
    await supabaseAdmin
      .from("ai_trading_decisions")
      .update({
        actual_outcome: outcome,
        pnl_result: pnl,
        was_correct: outcome === "win"
      })
      .eq("id", decisionId);
  }

  async updateStrategyPerformance(
    strategyId: number,
    userId: string,
    metricType: "backtest" | "paper" | "live",
    trades: Array<{ pnl: number; entryPrice: number; exitPrice: number; duration: string }>
  ): Promise<void> {
    if (!trades.length) return;

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
      : 0;

    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

    let maxDrawdown = 0;
    let peak = 0;
    let cumPnl = 0;
    for (const trade of trades) {
      cumPnl += trade.pnl;
      if (cumPnl > peak) peak = cumPnl;
      const drawdown = peak > 0 ? (peak - cumPnl) / peak : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    let maxConsecWins = 0, maxConsecLosses = 0, currentWins = 0, currentLosses = 0;
    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWins++;
        currentLosses = 0;
        maxConsecWins = Math.max(maxConsecWins, currentWins);
      } else if (trade.pnl < 0) {
        currentLosses++;
        currentWins = 0;
        maxConsecLosses = Math.max(maxConsecLosses, currentLosses);
      }
    }

    const aiInsights = await this.generatePerformanceInsights({
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      totalTrades: trades.length,
      riskRewardRatio
    });

    await supabaseAdmin.from("strategy_performance_metrics").insert({
      strategy_id: strategyId,
      user_id: userId,
      metric_type: metricType,
      total_trades: trades.length,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      win_rate: winRate,
      avg_win: avgWin,
      avg_loss: avgLoss,
      risk_reward_ratio: riskRewardRatio,
      profit_factor: profitFactor,
      max_drawdown: maxDrawdown,
      total_pnl: totalPnl,
      max_consecutive_wins: maxConsecWins,
      max_consecutive_losses: maxConsecLosses,
      best_trade_pnl: Math.max(...trades.map(t => t.pnl)),
      worst_trade_pnl: Math.min(...trades.map(t => t.pnl)),
      raw_trades: trades,
      ai_insights: aiInsights
    });
  }

  private async generatePerformanceInsights(metrics: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    maxDrawdown: number;
    totalTrades: number;
    riskRewardRatio: number;
  }): Promise<{ suggestions: string[]; grade: string; confidence: number }> {
    const suggestions: string[] = [];
    let grade = "C";
    let score = 50;

    if (metrics.winRate >= 0.6) {
      score += 20;
      suggestions.push("Strong win rate - maintain current entry criteria");
    } else if (metrics.winRate < 0.4) {
      score -= 10;
      suggestions.push("Low win rate - consider tightening entry conditions or waiting for higher probability setups");
    }

    if (metrics.riskRewardRatio >= 2) {
      score += 15;
      suggestions.push("Excellent risk/reward - winning trades are significantly larger than losses");
    } else if (metrics.riskRewardRatio < 1) {
      score -= 15;
      suggestions.push("Poor risk/reward - losses are larger than wins. Widen targets or tighten stops.");
    }

    if (metrics.profitFactor >= 2) {
      score += 15;
    } else if (metrics.profitFactor < 1) {
      score -= 20;
      suggestions.push("Unprofitable overall - strategy needs significant improvements");
    }

    if (metrics.maxDrawdown > 0.2) {
      score -= 10;
      suggestions.push("High drawdown detected - reduce position sizes or add filters to avoid losing streaks");
    }

    if (metrics.totalTrades < 30) {
      suggestions.push("Limited sample size - results may not be statistically significant");
    }

    if (metrics.avgWin < metrics.avgLoss * 1.5) {
      suggestions.push("Winners are not significantly larger than losers - consider trailing stops to let winners run");
    }

    if (score >= 80) grade = "A";
    else if (score >= 65) grade = "B";
    else if (score >= 50) grade = "C";
    else if (score >= 35) grade = "D";
    else grade = "F";

    return {
      suggestions,
      grade,
      confidence: Math.min(100, Math.max(0, score))
    };
  }

  async suggestStrategyImprovements(strategyId: number): Promise<{
    suggestions: string[];
    optimizedParams?: Record<string, unknown>;
    expectedImprovement: number;
  }> {
    const performance = await this.getStrategyPerformance(strategyId);
    const learnings = await this.getStrategyLearnings(strategyId);

    const { data: strategy } = await supabaseAdmin
      .from("strategies")
      .select("*")
      .eq("id", strategyId)
      .single();

    if (!strategy) {
      return { suggestions: ["Strategy not found"], expectedImprovement: 0 };
    }

    const { data: evolutions } = await supabaseAdmin
      .from("ai_strategy_evolution")
      .select("*")
      .eq("strategy_id", strategyId)
      .order("version", { ascending: false })
      .limit(5);

    const systemPrompt = `You are an AI Strategy Optimizer. Analyze the strategy performance and suggest specific improvements.

CURRENT STRATEGY:
${JSON.stringify({
  name: strategy.name,
  buy_entry: strategy.buy_entry_logic,
  sell_entry: strategy.sell_entry_logic,
  stop_loss: strategy.buy_stop_loss,
  target: strategy.buy_target
}, null, 2)}

PERFORMANCE METRICS:
${performance ? JSON.stringify(performance, null, 2) : "No performance data yet"}

LEARNINGS FROM TRADES:
${learnings.join('\n')}

PREVIOUS OPTIMIZATION ATTEMPTS:
${evolutions?.length ? evolutions.map(e => `v${e.version}: ${e.improvement_reason} (${e.improvement_pct}% improvement)`).join('\n') : 'None'}

OPTIMIZATION PRINCIPLES:
1. WIN BIG: Increase target when winning, use trailing stops
2. LOSE SMALL: Tighten stop loss, reduce position on uncertainty
3. FILTER NOISE: Add conditions to avoid low-quality setups
4. ADAPT: Adjust parameters based on market conditions

OUTPUT FORMAT (JSON):
{
  "suggestions": ["specific actionable suggestion 1", "suggestion 2"],
  "optimizedParams": {
    "stop_loss_pct": number,
    "target_pct": number,
    "trailing_stop": boolean,
    "additional_filter": "string or null"
  },
  "expectedImprovement": 0-50,
  "reasoning": "brief explanation"
}`;

    const result = await airaBrain.executeAnalysis("strategy_optimization", [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Analyze and suggest improvements for this strategy" }
    ], { maxTokens: 1000, skipCache: true });

    if (result.success && result.result) {
      try {
        const parsed = typeof result.result === 'string'
          ? JSON.parse(result.result.replace(/```json\n?|\n?```/g, ''))
          : result.result;

        const currentVersion = evolutions?.[0]?.version || 0;
        await supabaseAdmin.from("ai_strategy_evolution").insert({
          strategy_id: strategyId,
          version: currentVersion + 1,
          original_params: {
            buy_entry: strategy.buy_entry_logic,
            stop_loss: strategy.buy_stop_loss,
            target: strategy.buy_target
          },
          optimized_params: parsed.optimizedParams,
          optimization_type: "ai_analysis",
          improvement_reason: parsed.reasoning,
          before_metrics: performance,
          improvement_pct: parsed.expectedImprovement,
          ai_confidence: parsed.expectedImprovement,
          is_applied: false
        });

        return {
          suggestions: parsed.suggestions || [],
          optimizedParams: parsed.optimizedParams,
          expectedImprovement: parsed.expectedImprovement || 0
        };
      } catch {
        return { suggestions: ["Failed to parse optimization suggestions"], expectedImprovement: 0 };
      }
    }

    return { suggestions: ["AI analysis unavailable"], expectedImprovement: 0 };
  }

  async applyEvolution(evolutionId: number, strategyId: number): Promise<boolean> {
    const { data: evolution } = await supabaseAdmin
      .from("ai_strategy_evolution")
      .select("*")
      .eq("id", evolutionId)
      .single();

    if (!evolution) return false;

    const updates: Record<string, unknown> = {};
    
    if (evolution.optimized_params?.stop_loss_pct) {
      updates.buy_stop_loss = {
        ...(typeof evolution.original_params?.stop_loss === 'object' ? evolution.original_params.stop_loss : {}),
        value: evolution.optimized_params.stop_loss_pct
      };
    }
    
    if (evolution.optimized_params?.target_pct) {
      updates.buy_target = {
        ...(typeof evolution.original_params?.target === 'object' ? evolution.original_params.target : {}),
        value: evolution.optimized_params.target_pct
      };
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from("strategies")
        .update(updates)
        .eq("id", strategyId);

      await supabaseAdmin
        .from("ai_strategy_evolution")
        .update({ is_applied: true })
        .eq("id", evolutionId);

      return true;
    }

    return false;
  }
}

export const aiTradingEngine = AITradingEngine.getInstance();
