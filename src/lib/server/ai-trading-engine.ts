import { airaBrain } from "./aira-brain";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  rlScore?: number;
  rlRecommendation?: string;
}

export interface MarketContext {
  trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
  volatility: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  momentum: number;
  volume: "LOW" | "AVERAGE" | "HIGH";
  keyLevels: { support: number[]; resistance: number[] };
}

export interface StrategyImprovement {
  suggestions: string[];
  optimizedParams?: Record<string, unknown>;
  expectedImprovement: number;
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

  async updateStrategyPerformance(
    strategyId: number,
    userId: string,
    source: "backtest" | "live",
    trades: Array<{ pnl: number; entryPrice: number; exitPrice: number; duration: string }>
  ): Promise<void> {
    try {
      const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
      const winningTrades = trades.filter(t => t.pnl > 0).length;
      const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

      await supabaseAdmin.from("ai_strategy_learnings").insert({
        strategy_id: strategyId,
        learning_type: source,
        pattern_identified: `${trades.length} trades analyzed`,
        confidence_score: Math.min(1, trades.length / 50),
        win_rate_impact: winRate,
        risk_reward_impact: totalPnl > 0 ? 1.5 : 0.5,
        sample_size: trades.length,
        market_conditions: { source, totalPnl, winRate },
      });
    } catch (error) {
      console.error("[AITradingEngine] Failed to update performance:", error);
    }
  }

  async suggestStrategyImprovements(strategyId: number): Promise<StrategyImprovement> {
    try {
      const { data: learnings } = await supabaseAdmin
        .from("ai_strategy_learnings")
        .select("*")
        .eq("strategy_id", strategyId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!learnings || learnings.length === 0) {
        return { suggestions: ["Insufficient data for improvements"], expectedImprovement: 0 };
      }

      const avgWinRate = learnings.reduce((sum, l) => sum + (l.win_rate_impact || 0), 0) / learnings.length;
      const suggestions: string[] = [];
      let expectedImprovement = 0;

      if (avgWinRate < 50) {
        suggestions.push("Consider adding stricter entry filters");
        suggestions.push("Review stop-loss placement - may be too tight");
        expectedImprovement = 15;
      } else if (avgWinRate < 60) {
        suggestions.push("Fine-tune indicator parameters");
        suggestions.push("Consider adding trend confirmation");
        expectedImprovement = 10;
      } else {
        suggestions.push("Strategy performing well - consider position sizing optimization");
        expectedImprovement = 5;
      }

      const { data: globalWeights } = await supabaseAdmin
        .from("rl_global_weights")
        .select("weights")
        .eq("id", "global_v1")
        .single();

      const optimizedParams = globalWeights?.weights?.optimized_params_avg || {};

      return { suggestions, optimizedParams, expectedImprovement };
    } catch (error) {
      console.error("[AITradingEngine] Failed to suggest improvements:", error);
      return { suggestions: ["Error analyzing strategy"], expectedImprovement: 0 };
    }
  }

  async applyEvolution(evolutionId: number, _strategyId: number): Promise<boolean> {
    try {
      await supabaseAdmin
        .from("ai_strategy_evolution")
        .update({ is_applied: true, applied_at: new Date().toISOString() })
        .eq("id", evolutionId);

      return true;
    } catch (error) {
      console.error("[AITradingEngine] Failed to apply evolution:", error);
      return false;
    }
  }

  async analyzeChartForStrategy(
    _strategyId: number,
    candles: Array<{ open: number; high: number; low: number; close: number; volume: number; timestamp: Date }>,
    strategyRules: unknown,
    timeframe: string,
    instrumentToken?: number,
    _tradingSymbol?: string
  ): Promise<TradeDecision> {
    const marketContext = this.analyzeMarketContext(candles);

    let rlScore = 50;
    let rlRecommendation = "NEUTRAL";
    
    if (instrumentToken) {
      try {
        const { rlKnowledgeEngine } = await import("./rl-knowledge-engine");
        const scores = await rlKnowledgeEngine.scoreTradeSelection(
          [instrumentToken],
          JSON.stringify(strategyRules),
          timeframe,
          {
            trend: marketContext.trend,
            volatility: marketContext.volatility,
            volume: marketContext.volume
          }
        );
        
        if (scores.length > 0) {
          rlScore = scores[0].score;
          rlRecommendation = scores[0].recommendation;
          
          if (rlRecommendation === "STRONG_AVOID" || rlRecommendation === "AVOID") {
            return {
              action: "SKIP",
              confidence: 20,
              signalStrength: 0,
              reasoning: `RL Engine recommends avoiding: ${scores[0].reasoning}`,
              riskRewardRatio: 0,
              suggestedSize: 0,
              rlScore,
              rlRecommendation
            };
          }
        }
      } catch (error) {
        console.error("[AITradingEngine] RL scoring failed:", error);
      }
    }

    const recentCandles = candles.slice(-50);
    const candlesData = recentCandles.map(c => ({
      o: c.open.toFixed(2),
      h: c.high.toFixed(2),
      l: c.low.toFixed(2),
      c: c.close.toFixed(2),
      v: c.volume
    }));

    const rlContext = rlScore >= 70 
      ? `\n\n🤖 RL ENGINE INSIGHT: This instrument has a profitability score of ${rlScore}/100 (${rlRecommendation}). Historical data suggests favorable conditions.`
      : rlScore <= 40
      ? `\n\n⚠️ RL ENGINE WARNING: This instrument has a low profitability score of ${rlScore}/100 (${rlRecommendation}). Exercise caution.`
      : "";

    const systemPrompt = `You are an EXPERT INSTITUTIONAL TRADER AI.
    You use MT5-style institutional patterns: Fair Value Gaps (FVG), Liquidity Sweeps, Order Blocks, and Market Structure Shifts (MSS).
    
    🔒 CORE PRINCIPLE:
    "Strategies define WHEN to trade. AI Analysis defines WHEN NOT to trade."
    Your job is TRADE SELECTION and RISK MANAGEMENT.

    🎯 INSTITUTIONAL FILTERS:
    1. LIQUIDITY: Has the price swept a major high or low before this signal?
    2. IMBALANCE: Is there a Fair Value Gap (FVG) nearby that needs to be filled?
    3. STRUCTURE: Has there been a Market Structure Shift (MSS) on this timeframe?
    4. POI: Is the entry within a valid Order Block or Supply/Demand zone?

    📊 SECTION 1 - STRATEGY LOGIC:
    ${JSON.stringify(strategyRules, null, 2)}

    📈 SECTION 2 - MARKET CONTEXT:
    - Trend: ${marketContext.trend}
    - Momentum: ${marketContext.momentum.toFixed(2)}%
    - Support: ${marketContext.keyLevels.support.slice(0, 3).join(', ')}
    - Resistance: ${marketContext.keyLevels.resistance.slice(0, 3).join(', ')}${rlContext}

    📋 OUTPUT FORMAT (STRICT JSON):
    {
      "action": "ENTRY|EXIT|SKIP|HOLD",
      "direction": "LONG|SHORT",
      "confidence": 0-100,
      "reasoning": "Expert institutional analysis of FVG, Liquidity, and Structure",
      "riskRewardRatio": number,
      "stopLoss": price,
      "target": price,
      "suggestedSize": 0.1-1.0,
      "trailingStop": price or null
    }

    DECISION RULES:
    - Confidence < 75% → SKIP
    - Risk/Reward < 2.0 → SKIP
    - No Institutional Pattern (FVG/OB/Sweep) → SKIP`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this ${timeframe} data: ${JSON.stringify(candlesData)}` }
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

        let finalConfidence = parsed.confidence || 0;
        if (rlScore >= 70) finalConfidence = Math.min(100, finalConfidence + 10);
        else if (rlScore <= 40) finalConfidence = Math.max(0, finalConfidence - 15);

        return {
          action: parsed.action || "SKIP",
          direction: parsed.direction,
          confidence: finalConfidence,
          signalStrength: parsed.signalStrength || 0,
          reasoning: parsed.reasoning || "No reasoning provided",
          riskRewardRatio: parsed.riskRewardRatio || 2,
          suggestedSize: parsed.suggestedSize || 0.5,
          stopLoss: parsed.stopLoss,
          target: parsed.target,
          trailingStop: parsed.trailingStop,
          rlScore,
          rlRecommendation
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
    const currentPrice = closes[closes.length - 1];
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    let trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS" = "SIDEWAYS";
    if (currentPrice > sma20 * 1.01) trend = "UPTREND";
    else if (currentPrice < sma20 * 0.99) trend = "DOWNTREND";

    const momentum = ((currentPrice - closes[closes.length - 14]) / closes[closes.length - 14]) * 100;
    
    return {
      trend,
      volatility: "NORMAL",
      momentum,
      volume: "AVERAGE",
      keyLevels: {
        support: lows.slice(-50).sort((a, b) => a - b).slice(0, 5),
        resistance: highs.slice(-50).sort((a, b) => b - a).slice(0, 5)
      }
    };
  }
}

export const aiTradingEngine = AITradingEngine.getInstance();
