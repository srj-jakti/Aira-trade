import { supabaseAdmin } from "@/lib/supabase/admin";

export interface InstrumentProfitability {
  instrumentToken: number;
  tradingSymbol: string;
  patternType: string;
  timeframe: string;
  profitabilityScore: number;
  confidence: number;
  avgWinRate: number;
  avgPnlPerTrade: number;
  totalSignals: number;
  trendFollowingScore: number;
  meanReversionScore: number;
}

export interface TradeSelectionScore {
  instrumentToken: number;
  tradingSymbol: string;
  score: number;
  factors: {
    patternMatch: number;
    historicalProfitability: number;
    currentConditionMatch: number;
    liquidityScore: number;
    volatilityFit: number;
  };
  recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "AVOID" | "STRONG_AVOID";
  reasoning: string;
}

export interface PatternKnowledge {
  patternId: string;
  patternType: string;
  successRate: number;
  avgPnl: number;
  bestTimeframes: string[];
  bestMarketConditions: string[];
  worstMarketConditions: string[];
  sampleSize: number;
}

class RLKnowledgeEngine {
  private static instance: RLKnowledgeEngine;

  private constructor() {}

  static getInstance(): RLKnowledgeEngine {
    if (!RLKnowledgeEngine.instance) {
      RLKnowledgeEngine.instance = new RLKnowledgeEngine();
    }
    return RLKnowledgeEngine.instance;
  }

  async getInstrumentProfitability(
    instrumentToken: number,
    patternType: string,
    timeframe: string
  ): Promise<InstrumentProfitability | null> {
    const { data } = await supabaseAdmin
      .from("instrument_profitability_knowledge")
      .select("*")
      .eq("instrument_token", instrumentToken)
      .eq("pattern_type", patternType)
      .eq("timeframe", timeframe)
      .single();

    if (!data) return null;

    return {
      instrumentToken: data.instrument_token,
      tradingSymbol: data.trading_symbol,
      patternType: data.pattern_type,
      timeframe: data.timeframe,
      profitabilityScore: data.profitability_score,
      confidence: data.confidence,
      avgWinRate: data.avg_win_rate,
      avgPnlPerTrade: data.avg_pnl_per_trade,
      totalSignals: data.total_signals,
      trendFollowingScore: data.trend_following_score,
      meanReversionScore: data.mean_reversion_score,
    };
  }

  async getTopProfitableInstruments(
    patternType: string,
    timeframe: string,
    limit: number = 10,
    minConfidence: number = 0.5
  ): Promise<InstrumentProfitability[]> {
    const { data } = await supabaseAdmin
      .from("instrument_profitability_knowledge")
      .select("*")
      .eq("pattern_type", patternType)
      .eq("timeframe", timeframe)
      .gte("confidence", minConfidence)
      .gte("total_signals", 5)
      .order("profitability_score", { ascending: false })
      .limit(limit);

    return (data || []).map((d) => ({
      instrumentToken: d.instrument_token,
      tradingSymbol: d.trading_symbol,
      patternType: d.pattern_type,
      timeframe: d.timeframe,
      profitabilityScore: d.profitability_score,
      confidence: d.confidence,
      avgWinRate: d.avg_win_rate,
      avgPnlPerTrade: d.avg_pnl_per_trade,
      totalSignals: d.total_signals,
      trendFollowingScore: d.trend_following_score,
      meanReversionScore: d.mean_reversion_score,
    }));
  }

  async scoreTradeSelection(
    instrumentTokens: number[],
    strategyPattern: string,
    timeframe: string,
    marketConditions: {
      trend: string;
      volatility: string;
      volume: string;
    }
  ): Promise<TradeSelectionScore[]> {
    const scores: TradeSelectionScore[] = [];

    const { data: instruments } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, tradingsymbol, name")
      .in("instrument_token", instrumentTokens);

    const instrumentMap = new Map(
      (instruments || []).map((i) => [i.instrument_token, i])
    );

    const { data: globalWeights } = await supabaseAdmin
      .from("rl_global_weights")
      .select("weights")
      .eq("id", "global_v1")
      .single();

    const patternType = this.extractPatternType(strategyPattern);

    for (const token of instrumentTokens) {
      const profitability = await this.getInstrumentProfitability(
        token,
        patternType,
        timeframe
      );

      const instrument = instrumentMap.get(token);
      const tradingSymbol = instrument?.tradingsymbol || `TOKEN_${token}`;

      let patternMatch = 50;
      let historicalProfitability = 50;
      let currentConditionMatch = 50;
      let liquidityScore = 70;
      let volatilityFit = 60;

      if (profitability) {
        patternMatch = Math.min(100, profitability.confidence * 100);
        historicalProfitability = Math.min(100, profitability.profitabilityScore);

        if (marketConditions.trend === "UPTREND" && profitability.trendFollowingScore > 60) {
          currentConditionMatch = 80;
        } else if (marketConditions.trend === "SIDEWAYS" && profitability.meanReversionScore > 60) {
          currentConditionMatch = 75;
        }

        liquidityScore = Math.min(100, 50 + profitability.totalSignals * 2);
      }

      if (globalWeights?.weights?.optimized_params_avg) {
        const avgParams = globalWeights.weights.optimized_params_avg;
        if (avgParams.preferred_timeframe === timeframe) {
          patternMatch += 10;
        }
      }

      if (marketConditions.volatility === "HIGH") {
        volatilityFit = profitability?.trendFollowingScore || 50;
      } else if (marketConditions.volatility === "LOW") {
        volatilityFit = profitability?.meanReversionScore || 50;
      }

      const totalScore =
        patternMatch * 0.25 +
        historicalProfitability * 0.35 +
        currentConditionMatch * 0.2 +
        liquidityScore * 0.1 +
        volatilityFit * 0.1;

      let recommendation: TradeSelectionScore["recommendation"] = "NEUTRAL";
      if (totalScore >= 80) recommendation = "STRONG_BUY";
      else if (totalScore >= 65) recommendation = "BUY";
      else if (totalScore >= 45) recommendation = "NEUTRAL";
      else if (totalScore >= 30) recommendation = "AVOID";
      else recommendation = "STRONG_AVOID";

      const reasoning = this.generateReasoning(
        tradingSymbol,
        totalScore,
        { patternMatch, historicalProfitability, currentConditionMatch, liquidityScore, volatilityFit },
        profitability
      );

      scores.push({
        instrumentToken: token,
        tradingSymbol,
        score: Math.round(totalScore * 100) / 100,
        factors: {
          patternMatch,
          historicalProfitability,
          currentConditionMatch,
          liquidityScore,
          volatilityFit,
        },
        recommendation,
        reasoning,
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  async updateInstrumentKnowledge(
    instrumentToken: number,
    tradingSymbol: string,
    patternType: string,
    timeframe: string,
    tradeResult: {
      pnl: number;
      isProfit: boolean;
      riskReward: number;
      entryConditions: Record<string, unknown>;
      marketCondition: string;
    }
  ): Promise<void> {
    const { data: existing } = await supabaseAdmin
      .from("instrument_profitability_knowledge")
      .select("*")
      .eq("instrument_token", instrumentToken)
      .eq("pattern_type", patternType)
      .eq("timeframe", timeframe)
      .single();

    if (existing) {
      const newTotalSignals = existing.total_signals + 1;
      const newProfitableSignals = existing.profitable_signals + (tradeResult.isProfit ? 1 : 0);
      const newAvgPnl =
        (existing.avg_pnl_per_trade * existing.total_signals + tradeResult.pnl) / newTotalSignals;
      const newWinRate = (newProfitableSignals / newTotalSignals) * 100;
      const newAvgRR =
        (existing.avg_risk_reward * existing.total_signals + tradeResult.riskReward) / newTotalSignals;

      let trendScore = existing.trend_following_score;
      let meanRevScore = existing.mean_reversion_score;

      if (tradeResult.marketCondition === "trending" && tradeResult.isProfit) {
        trendScore = Math.min(100, trendScore + 2);
      } else if (tradeResult.marketCondition === "ranging" && tradeResult.isProfit) {
        meanRevScore = Math.min(100, meanRevScore + 2);
      }

      const profitabilityScore = this.calculateProfitabilityScore(
        newWinRate,
        newAvgPnl,
        newAvgRR,
        newTotalSignals
      );

      const confidence = Math.min(1, newTotalSignals / 20);

      await supabaseAdmin
        .from("instrument_profitability_knowledge")
        .update({
          total_signals: newTotalSignals,
          profitable_signals: newProfitableSignals,
          avg_pnl_per_trade: newAvgPnl,
          avg_win_rate: newWinRate,
          avg_risk_reward: newAvgRR,
          trend_following_score: trendScore,
          mean_reversion_score: meanRevScore,
          profitability_score: profitabilityScore,
          confidence,
          best_entry_conditions: tradeResult.isProfit ? tradeResult.entryConditions : existing.best_entry_conditions,
          worst_entry_conditions: !tradeResult.isProfit ? tradeResult.entryConditions : existing.worst_entry_conditions,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      const winRate = tradeResult.isProfit ? 100 : 0;
      const profitabilityScore = this.calculateProfitabilityScore(
        winRate,
        tradeResult.pnl,
        tradeResult.riskReward,
        1
      );

      await supabaseAdmin.from("instrument_profitability_knowledge").insert({
        instrument_token: instrumentToken,
        trading_symbol: tradingSymbol,
        pattern_type: patternType,
        timeframe,
        total_signals: 1,
        profitable_signals: tradeResult.isProfit ? 1 : 0,
        avg_pnl_per_trade: tradeResult.pnl,
        avg_win_rate: winRate,
        avg_risk_reward: tradeResult.riskReward,
        trend_following_score: tradeResult.marketCondition === "trending" && tradeResult.isProfit ? 60 : 50,
        mean_reversion_score: tradeResult.marketCondition === "ranging" && tradeResult.isProfit ? 60 : 50,
        profitability_score: profitabilityScore,
        confidence: 0.05,
        best_entry_conditions: tradeResult.isProfit ? tradeResult.entryConditions : {},
        worst_entry_conditions: !tradeResult.isProfit ? tradeResult.entryConditions : {},
      });
    }
  }

  async getGlobalRLInsights(): Promise<{
    totalSimulations: number;
    optimizedParams: Record<string, number>;
    recommendedTimeframe: string;
    lastUpdated: string;
  }> {
    const { data } = await supabaseAdmin
      .from("rl_global_weights")
      .select("weights, updated_at")
      .eq("id", "global_v1")
      .single();

    if (!data?.weights) {
      return {
        totalSimulations: 0,
        optimizedParams: {},
        recommendedTimeframe: "15m",
        lastUpdated: new Date().toISOString(),
      };
    }

    return {
      totalSimulations: data.weights.total_simulations || 0,
      optimizedParams: data.weights.optimized_params_avg || {},
      recommendedTimeframe: data.weights.optimized_params_avg?.preferred_timeframe || "15m",
      lastUpdated: data.updated_at || new Date().toISOString(),
    };
  }

  async selectBestInstrumentsForStrategy(
    candidateTokens: number[],
    strategyPattern: string,
    timeframe: string,
    maxSelections: number = 5
  ): Promise<{ selected: number[]; reasoning: string[] }> {
    const scores = await this.scoreTradeSelection(
      candidateTokens,
      strategyPattern,
      timeframe,
      { trend: "SIDEWAYS", volatility: "NORMAL", volume: "AVERAGE" }
    );

    const selected: number[] = [];
    const reasoning: string[] = [];

    for (const score of scores) {
      if (selected.length >= maxSelections) break;
      
      if (score.recommendation === "STRONG_BUY" || score.recommendation === "BUY") {
        selected.push(score.instrumentToken);
        reasoning.push(`${score.tradingSymbol}: ${score.reasoning}`);
      } else if (score.recommendation === "NEUTRAL" && selected.length < 2) {
        selected.push(score.instrumentToken);
        reasoning.push(`${score.tradingSymbol}: Selected as fallback - ${score.reasoning}`);
      }
    }

    if (selected.length === 0 && candidateTokens.length > 0) {
      const fallback = scores[0];
      selected.push(fallback.instrumentToken);
      reasoning.push(`${fallback.tradingSymbol}: No high-confidence match found, selected top scorer`);
    }

    return { selected, reasoning };
  }

  private extractPatternType(strategyPattern: string): string {
    const lowerPattern = strategyPattern.toLowerCase();
    
    if (lowerPattern.includes("rsi") && lowerPattern.includes("oversold")) return "rsi_oversold";
    if (lowerPattern.includes("rsi") && lowerPattern.includes("overbought")) return "rsi_overbought";
    if (lowerPattern.includes("macd") && lowerPattern.includes("cross")) return "macd_crossover";
    if (lowerPattern.includes("ema") && lowerPattern.includes("cross")) return "ema_crossover";
    if (lowerPattern.includes("breakout")) return "breakout";
    if (lowerPattern.includes("reversal")) return "reversal";
    if (lowerPattern.includes("momentum")) return "momentum";
    if (lowerPattern.includes("support") || lowerPattern.includes("resistance")) return "sr_bounce";
    
    return "generic";
  }

  private calculateProfitabilityScore(
    winRate: number,
    avgPnl: number,
    avgRR: number,
    sampleSize: number
  ): number {
    const winRateScore = winRate * 0.4;
    const pnlScore = Math.min(30, Math.max(-30, avgPnl / 100)) + 30;
    const rrScore = Math.min(20, avgRR * 10);
    const sampleBonus = Math.min(10, sampleSize / 2);

    return Math.min(100, Math.max(0, winRateScore + pnlScore + rrScore + sampleBonus));
  }

  private generateReasoning(
    symbol: string,
    score: number,
    factors: Record<string, number>,
    profitability: InstrumentProfitability | null
  ): string {
    const parts: string[] = [];

    if (factors.historicalProfitability >= 70) {
      parts.push("Strong historical performance");
    } else if (factors.historicalProfitability <= 40) {
      parts.push("Weak historical performance");
    }

    if (factors.patternMatch >= 70) {
      parts.push("High pattern confidence");
    }

    if (profitability) {
      if (profitability.avgWinRate >= 60) {
        parts.push(`${profitability.avgWinRate.toFixed(0)}% win rate`);
      }
      if (profitability.totalSignals >= 20) {
        parts.push(`${profitability.totalSignals} historical trades`);
      }
    }

    if (parts.length === 0) {
      parts.push("Limited historical data");
    }

    return parts.join(", ");
  }
}

export const rlKnowledgeEngine = RLKnowledgeEngine.getInstance();
