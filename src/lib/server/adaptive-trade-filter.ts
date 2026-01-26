import { supabaseAdmin } from "@/lib/supabase/admin";
import { marketContextEngine, MarketContext, MarketRegime } from "./market-context-engine";
import { semanticStrategyEngine, StrategyUnderstanding, StrategyAnalysisInput } from "./semantic-strategy-engine";
import { patternMemoryEngine, PatternMatch } from "./pattern-memory-engine";
import { rlKnowledgeEngine, TradeSelectionScore } from "./rl-knowledge-engine";

export interface TradeQualityAssessment {
  overallScore: number;
  recommendation: "STRONG_ENTRY" | "ENTRY" | "WEAK_ENTRY" | "SKIP" | "AVOID";
  shouldTrade: boolean;
  confidence: number;
  reasoning: string[];
  scores: {
    regimeAlignment: number;
    patternMatch: number;
    historicalSuccess: number;
    riskReward: number;
    momentum: number;
    volume: number;
  };
  marketContext: MarketContext;
  strategyMatch: { matches: boolean; score: number; reasons: string[] } | null;
  patternAnalysis: { shouldTrade: boolean; confidence: number; reason: string; similarPatterns: PatternMatch[] };
  rlScore: TradeSelectionScore | null;
  improvements: string[];
}

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

interface TradeFilterInput {
  strategyId: number;
  strategy: StrategyAnalysisInput;
  instrumentToken: number;
  tradingSymbol: string;
  timeframe: string;
  candles: CandleData[];
  indicators: Record<string, number>;
  proposedEntry: {
    direction: "LONG" | "SHORT";
    price: number;
    stopLoss: number;
    target: number;
  };
}

class AdaptiveTradeFilter {
  private static instance: AdaptiveTradeFilter;

  private constructor() {}

  static getInstance(): AdaptiveTradeFilter {
    if (!AdaptiveTradeFilter.instance) {
      AdaptiveTradeFilter.instance = new AdaptiveTradeFilter();
    }
    return AdaptiveTradeFilter.instance;
  }

  async assessTradeQuality(input: TradeFilterInput): Promise<TradeQualityAssessment> {
    const reasoning: string[] = [];
    const improvements: string[] = [];

    const marketContext = await marketContextEngine.analyzeMarketContext(
      input.candles,
      input.instrumentToken,
      input.timeframe
    );

    let strategyUnderstanding: StrategyUnderstanding | null = null;
    let strategyMatch: { matches: boolean; score: number; reasons: string[] } | null = null;

    try {
      strategyUnderstanding = await semanticStrategyEngine.understandStrategy(
        input.strategyId,
        input.strategy
      );
      
      strategyMatch = semanticStrategyEngine.isStrategyMatchingConditions(
        strategyUnderstanding,
        marketContext.regime,
        marketContext.volatility
      );
      
      reasoning.push(...strategyMatch.reasons);
    } catch (error) {
      console.error("[AdaptiveTradeFilter] Strategy understanding failed:", error);
    }

    const patternAnalysis = await patternMemoryEngine.getTradeRecommendation(
      input.indicators,
      input.candles,
      marketContext,
      input.instrumentToken,
      input.timeframe
    );

    reasoning.push(patternAnalysis.reason);

    let rlScore: TradeSelectionScore | null = null;
    try {
      const scores = await rlKnowledgeEngine.scoreTradeSelection(
        [input.instrumentToken],
        JSON.stringify(input.strategy),
        input.timeframe,
        {
          trend: marketContext.trendDirection === "UP" ? "UPTREND" : 
                 marketContext.trendDirection === "DOWN" ? "DOWNTREND" : "SIDEWAYS",
          volatility: marketContext.volatility,
          volume: marketContext.volumeProfile,
        }
      );
      
      if (scores.length > 0) {
        rlScore = scores[0];
        reasoning.push(`RL Engine: ${rlScore.reasoning}`);
      }
    } catch (error) {
      console.error("[AdaptiveTradeFilter] RL scoring failed:", error);
    }

    const regimeAlignmentScore = this.calculateRegimeAlignmentScore(
      marketContext,
      strategyUnderstanding,
      input.proposedEntry.direction
    );

    const patternMatchScore = patternAnalysis.confidence * 100;

    const historicalSuccessScore = rlScore ? rlScore.factors.historicalProfitability : 50;

    const riskRewardScore = this.calculateRiskRewardScore(input.proposedEntry);

    const momentumScore = this.calculateMomentumScore(marketContext, input.proposedEntry.direction);

    const volumeScore = this.calculateVolumeScore(marketContext);

    const overallScore = this.calculateOverallScore({
      regimeAlignment: regimeAlignmentScore,
      patternMatch: patternMatchScore,
      historicalSuccess: historicalSuccessScore,
      riskReward: riskRewardScore,
      momentum: momentumScore,
      volume: volumeScore,
    });

    const { recommendation, shouldTrade } = this.determineRecommendation(
      overallScore,
      strategyMatch,
      patternAnalysis,
      rlScore,
      marketContext
    );

    if (!shouldTrade) {
      if (regimeAlignmentScore < 50) {
        improvements.push(`Wait for ${strategyUnderstanding?.idealRegime || "better"} market conditions`);
      }
      if (patternMatchScore < 50) {
        improvements.push("Look for setups with better historical success rates");
      }
      if (riskRewardScore < 50) {
        improvements.push("Adjust stop loss and target for better risk/reward ratio");
      }
      if (momentumScore < 40) {
        improvements.push(`Wait for momentum to align with ${input.proposedEntry.direction} direction`);
      }
    }

    const assessment: TradeQualityAssessment = {
      overallScore,
      recommendation,
      shouldTrade,
      confidence: overallScore / 100,
      reasoning,
      scores: {
        regimeAlignment: regimeAlignmentScore,
        patternMatch: patternMatchScore,
        historicalSuccess: historicalSuccessScore,
        riskReward: riskRewardScore,
        momentum: momentumScore,
        volume: volumeScore,
      },
      marketContext,
      strategyMatch,
      patternAnalysis,
      rlScore,
      improvements,
    };

    await this.saveTradeQualityScore(input, assessment);

    return assessment;
  }

  private calculateRegimeAlignmentScore(
    context: MarketContext,
    understanding: StrategyUnderstanding | null,
    direction: "LONG" | "SHORT"
  ): number {
    let score = 50;

    const bullishRegimes: MarketRegime[] = ["STRONG_UPTREND", "UPTREND", "VOLATILE_BULLISH"];
    const bearishRegimes: MarketRegime[] = ["STRONG_DOWNTREND", "DOWNTREND", "VOLATILE_BEARISH"];
    const neutralRegimes: MarketRegime[] = ["SIDEWAYS", "CONSOLIDATION"];

    if (direction === "LONG") {
      if (bullishRegimes.includes(context.regime)) score += 30;
      else if (neutralRegimes.includes(context.regime)) score += 10;
      else score -= 20;
    } else {
      if (bearishRegimes.includes(context.regime)) score += 30;
      else if (neutralRegimes.includes(context.regime)) score += 10;
      else score -= 20;
    }

    if (understanding) {
      if (understanding.idealRegime === context.regime) {
        score += 20;
      } else if (
        (bullishRegimes.includes(understanding.idealRegime) && bullishRegimes.includes(context.regime)) ||
        (bearishRegimes.includes(understanding.idealRegime) && bearishRegimes.includes(context.regime)) ||
        (neutralRegimes.includes(understanding.idealRegime) && neutralRegimes.includes(context.regime))
      ) {
        score += 10;
      }
    }

    score += context.regimeStrength * 0.1;

    return Math.min(100, Math.max(0, score));
  }

  private calculateRiskRewardScore(entry: { stopLoss: number; target: number; price: number }): number {
    const risk = Math.abs(entry.price - entry.stopLoss);
    const reward = Math.abs(entry.target - entry.price);
    const rr = risk > 0 ? reward / risk : 0;

    if (rr >= 3) return 100;
    if (rr >= 2.5) return 90;
    if (rr >= 2) return 80;
    if (rr >= 1.5) return 60;
    if (rr >= 1) return 40;
    return 20;
  }

  private calculateMomentumScore(context: MarketContext, direction: "LONG" | "SHORT"): number {
    let score = 50;

    if (direction === "LONG") {
      if (context.momentum > 3) score += 30;
      else if (context.momentum > 1) score += 20;
      else if (context.momentum > 0) score += 10;
      else if (context.momentum < -2) score -= 30;
      else if (context.momentum < 0) score -= 15;

      if (context.macdSignal === "BULLISH") score += 15;
      else if (context.macdSignal === "BEARISH") score -= 15;

      if (context.emaAlignment === "BULLISH") score += 10;
      else if (context.emaAlignment === "BEARISH") score -= 10;
    } else {
      if (context.momentum < -3) score += 30;
      else if (context.momentum < -1) score += 20;
      else if (context.momentum < 0) score += 10;
      else if (context.momentum > 2) score -= 30;
      else if (context.momentum > 0) score -= 15;

      if (context.macdSignal === "BEARISH") score += 15;
      else if (context.macdSignal === "BULLISH") score -= 15;

      if (context.emaAlignment === "BEARISH") score += 10;
      else if (context.emaAlignment === "BULLISH") score -= 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateVolumeScore(context: MarketContext): number {
    const volumeScores: Record<string, number> = {
      "CLIMACTIC": 90,
      "HIGH": 80,
      "AVERAGE": 60,
      "LOW": 40,
      "VERY_LOW": 20,
    };

    return volumeScores[context.volumeProfile] || 50;
  }

  private calculateOverallScore(scores: Record<string, number>): number {
    const weights = {
      regimeAlignment: 0.25,
      patternMatch: 0.20,
      historicalSuccess: 0.20,
      riskReward: 0.15,
      momentum: 0.12,
      volume: 0.08,
    };

    return Math.round(
      scores.regimeAlignment * weights.regimeAlignment +
      scores.patternMatch * weights.patternMatch +
      scores.historicalSuccess * weights.historicalSuccess +
      scores.riskReward * weights.riskReward +
      scores.momentum * weights.momentum +
      scores.volume * weights.volume
    );
  }

  private determineRecommendation(
    overallScore: number,
    strategyMatch: { matches: boolean; score: number; reasons: string[] } | null,
    patternAnalysis: { shouldTrade: boolean; confidence: number },
    rlScore: TradeSelectionScore | null,
    context: MarketContext
  ): { recommendation: TradeQualityAssessment["recommendation"]; shouldTrade: boolean } {
    if (rlScore?.recommendation === "STRONG_AVOID") {
      return { recommendation: "AVOID", shouldTrade: false };
    }

    if (!patternAnalysis.shouldTrade && patternAnalysis.confidence > 0.6) {
      return { recommendation: "AVOID", shouldTrade: false };
    }

    if (strategyMatch && !strategyMatch.matches && strategyMatch.score < 40) {
      return { recommendation: "SKIP", shouldTrade: false };
    }

    if (context.volatility === "EXTREME" && overallScore < 70) {
      return { recommendation: "SKIP", shouldTrade: false };
    }

    if (overallScore >= 80) {
      return { recommendation: "STRONG_ENTRY", shouldTrade: true };
    }
    if (overallScore >= 65) {
      return { recommendation: "ENTRY", shouldTrade: true };
    }
    if (overallScore >= 50) {
      return { recommendation: "WEAK_ENTRY", shouldTrade: true };
    }
    if (overallScore >= 35) {
      return { recommendation: "SKIP", shouldTrade: false };
    }

    return { recommendation: "AVOID", shouldTrade: false };
  }

  private async saveTradeQualityScore(
    input: TradeFilterInput,
    assessment: TradeQualityAssessment
  ): Promise<void> {
    try {
      await supabaseAdmin.from("trade_quality_scores").insert({
        strategy_id: input.strategyId,
        instrument_token: input.instrumentToken,
        signal_timestamp: new Date().toISOString(),
        market_regime: assessment.marketContext.regime,
        pattern_match_score: assessment.scores.patternMatch,
        regime_alignment_score: assessment.scores.regimeAlignment,
        historical_success_score: assessment.scores.historicalSuccess,
        risk_reward_score: assessment.scores.riskReward,
        momentum_score: assessment.scores.momentum,
        volume_score: assessment.scores.volume,
        overall_quality_score: assessment.overallScore,
        recommendation: assessment.recommendation,
        reasoning: assessment.reasoning.join("; "),
      });
    } catch (error) {
      console.error("[AdaptiveTradeFilter] Failed to save quality score:", error);
    }
  }

  async recordTradeOutcome(
    qualityScoreId: number,
    outcome: "PROFIT" | "LOSS" | "BREAKEVEN",
    pnl: number
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from("trade_quality_scores")
        .update({
          actual_outcome: outcome,
          actual_pnl: pnl,
        })
        .eq("id", qualityScoreId);
    } catch (error) {
      console.error("[AdaptiveTradeFilter] Failed to record outcome:", error);
    }
  }

  async getFilterStats(strategyId?: number): Promise<{
    totalAssessments: number;
    avgQualityScore: number;
    strongEntryCount: number;
    skipCount: number;
    avoidCount: number;
    accuracyRate: number;
  }> {
    try {
      let query = supabaseAdmin
        .from("trade_quality_scores")
        .select("*");

      if (strategyId) {
        query = query.eq("strategy_id", strategyId);
      }

      const { data: scores } = await query;

      if (!scores || scores.length === 0) {
        return {
          totalAssessments: 0,
          avgQualityScore: 0,
          strongEntryCount: 0,
          skipCount: 0,
          avoidCount: 0,
          accuracyRate: 0,
        };
      }

      const avgQualityScore = scores.reduce((sum, s) => sum + (s.overall_quality_score || 0), 0) / scores.length;
      const strongEntryCount = scores.filter(s => s.recommendation === "STRONG_ENTRY").length;
      const skipCount = scores.filter(s => s.recommendation === "SKIP").length;
      const avoidCount = scores.filter(s => s.recommendation === "AVOID").length;

      const withOutcome = scores.filter(s => s.actual_outcome);
      let accuracyRate = 0;
      if (withOutcome.length > 0) {
        const correctPredictions = withOutcome.filter(s => {
          if (s.recommendation === "STRONG_ENTRY" || s.recommendation === "ENTRY") {
            return s.actual_outcome === "PROFIT";
          } else if (s.recommendation === "AVOID") {
            return s.actual_outcome === "LOSS";
          }
          return false;
        }).length;
        accuracyRate = (correctPredictions / withOutcome.length) * 100;
      }

      return {
        totalAssessments: scores.length,
        avgQualityScore,
        strongEntryCount,
        skipCount,
        avoidCount,
        accuracyRate,
      };
    } catch (error) {
      console.error("[AdaptiveTradeFilter] Failed to get stats:", error);
      return {
        totalAssessments: 0,
        avgQualityScore: 0,
        strongEntryCount: 0,
        skipCount: 0,
        avoidCount: 0,
        accuracyRate: 0,
      };
    }
  }
}

export const adaptiveTradeFilter = AdaptiveTradeFilter.getInstance();
