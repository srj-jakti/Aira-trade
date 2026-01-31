import { marketContextEngine, MarketContext } from "./market-context-engine";
import { semanticStrategyEngine, StrategyUnderstanding, StrategyAnalysisInput } from "./semantic-strategy-engine";
import { patternMemoryEngine, PatternSignature } from "./pattern-memory-engine";
import { adaptiveTradeFilter, TradeQualityAssessment } from "./adaptive-trade-filter";
import { rlKnowledgeEngine } from "./rl-knowledge-engine";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface IntelligentSignal {
  instrumentToken: number;
  tradingSymbol: string;
  direction: "LONG" | "SHORT";
  confidence: number;
  quality: TradeQualityAssessment;
  entryPrice: number;
  stopLoss: number;
  target: number;
  reasoning: string[];
  shouldExecute: boolean;
  blockReason?: string;
}

export interface LearningFeedback {
  strategyId: number;
  instrumentToken: number;
  tradingSymbol: string;
  timeframe: string;
  patternSignature: string;
  entryConditions: PatternSignature;
  marketContext: MarketContext;
  outcome: "PROFIT" | "LOSS" | "BREAKEVEN";
  pnl: number;
  riskReward: number;
  holdingMinutes: number;
}

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

class AIRAIntelligenceOrchestrator {
  private static instance: AIRAIntelligenceOrchestrator;

  private constructor() {}

  static getInstance(): AIRAIntelligenceOrchestrator {
    if (!AIRAIntelligenceOrchestrator.instance) {
      AIRAIntelligenceOrchestrator.instance = new AIRAIntelligenceOrchestrator();
    }
    return AIRAIntelligenceOrchestrator.instance;
  }

  async processSignal(
    strategyId: number,
    strategy: StrategyAnalysisInput,
    instrumentToken: number,
    tradingSymbol: string,
    timeframe: string,
    candles: CandleData[],
    proposedSignal: {
      direction: "LONG" | "SHORT";
      entryPrice: number;
      stopLoss: number;
      target: number;
    },
    indicators: Record<string, number> = {}
  ): Promise<IntelligentSignal> {
    const reasoning: string[] = [];

    const quality = await adaptiveTradeFilter.assessTradeQuality({
      strategyId,
      strategy,
      instrumentToken,
      tradingSymbol,
      timeframe,
      candles,
      indicators,
      proposedEntry: {
        direction: proposedSignal.direction,
        price: proposedSignal.entryPrice,
        stopLoss: proposedSignal.stopLoss,
        target: proposedSignal.target,
      },
    });

    reasoning.push(...quality.reasoning);

    const shouldExecute = quality.shouldTrade;
    let blockReason: string | undefined;

    if (!shouldExecute) {
      blockReason = `Trade blocked: ${quality.recommendation}. ${quality.improvements.join(". ")}`;
    }

    if (shouldExecute && quality.recommendation === "WEAK_ENTRY") {
      const riskAdjustment = this.adjustRiskForWeakEntry(proposedSignal);
      reasoning.push(`Weak entry detected - reducing position size to ${(riskAdjustment.positionSizeMultiplier * 100).toFixed(0)}%`);
    }

    if (quality.overallScore >= 80) {
      reasoning.push("HIGH CONVICTION: All intelligence systems aligned");
    } else if (quality.overallScore >= 65) {
      reasoning.push("MODERATE CONVICTION: Most factors favorable");
    } else if (shouldExecute) {
      reasoning.push("LOW CONVICTION: Proceed with caution");
    }

    return {
      instrumentToken,
      tradingSymbol,
      direction: proposedSignal.direction,
      confidence: quality.confidence,
      quality,
      entryPrice: proposedSignal.entryPrice,
      stopLoss: proposedSignal.stopLoss,
      target: proposedSignal.target,
      reasoning,
      shouldExecute,
      blockReason,
    };
  }

  async selectBestSignals(
    signals: IntelligentSignal[],
    maxSignals: number = 3
  ): Promise<IntelligentSignal[]> {
    const executableSignals = signals.filter(s => s.shouldExecute);

    const sortedSignals = executableSignals.sort((a, b) => {
      if (a.quality.recommendation === "STRONG_ENTRY" && b.quality.recommendation !== "STRONG_ENTRY") return -1;
      if (b.quality.recommendation === "STRONG_ENTRY" && a.quality.recommendation !== "STRONG_ENTRY") return 1;
      
      return b.quality.overallScore - a.quality.overallScore;
    });

    return sortedSignals.slice(0, maxSignals);
  }

  async recordTradeFeedback(feedback: LearningFeedback): Promise<void> {
    await patternMemoryEngine.recordPattern(
      feedback.patternSignature,
      feedback.instrumentToken,
      feedback.timeframe,
      feedback.marketContext.regime,
      feedback.entryConditions,
      feedback.outcome,
      feedback.pnl,
      feedback.riskReward,
      feedback.holdingMinutes
    );

    await rlKnowledgeEngine.updateInstrumentKnowledge(
      feedback.instrumentToken,
      feedback.tradingSymbol,
      feedback.entryConditions.candlePattern || "generic",
      feedback.timeframe,
      {
        pnl: feedback.pnl,
        isProfit: feedback.outcome === "PROFIT",
          riskReward: feedback.riskReward,
          entryConditions: feedback.entryConditions as any,
          marketCondition: feedback.marketContext.regime.includes("TREND") ? "trending" : "ranging",
      }
    );

    await this.logBrainEvent("LEARNING_FEEDBACK", {
      strategyId: feedback.strategyId,
      instrumentToken: feedback.instrumentToken,
      outcome: feedback.outcome,
      pnl: feedback.pnl,
      regime: feedback.marketContext.regime,
    });
  }

  async getIntelligenceSummary(strategyId: number): Promise<{
    strategyUnderstanding: StrategyUnderstanding | null;
    tradeFilterStats: {
      totalAssessments: number;
      avgQualityScore: number;
      accuracyRate: number;
    };
    patternStats: {
      totalPatterns: number;
      avgSuccessRate: number;
    };
    rlInsights: {
      totalSimulations: number;
      recommendedTimeframe: string;
    };
  }> {
    const tradeFilterStats = await adaptiveTradeFilter.getFilterStats(strategyId);

    let strategyUnderstanding: StrategyUnderstanding | null = null;
    try {
      const { data: strategy } = await supabaseAdmin
        .from("strategies")
        .select("*")
        .eq("id", strategyId)
        .single();

      if (strategy) {
        strategyUnderstanding = await semanticStrategyEngine.understandStrategy(
          strategyId,
          {
            name: strategy.name,
            entry: strategy.entry || {},
            exit: strategy.exit || {},
            timeframe: strategy.timeframe,
            zairothIntent: strategy.zairoth_intent,
          }
        );
      }
    } catch (error) {
      console.error("[AIRAIntelligence] Failed to get strategy understanding:", error);
    }

    const patternStats = await patternMemoryEngine.getPatternStats(
      strategyUnderstanding?.idealRegime || "SIDEWAYS",
      "15m"
    );

    const rlInsights = await rlKnowledgeEngine.getGlobalRLInsights();

    return {
      strategyUnderstanding,
      tradeFilterStats: {
        totalAssessments: tradeFilterStats.totalAssessments,
        avgQualityScore: tradeFilterStats.avgQualityScore,
        accuracyRate: tradeFilterStats.accuracyRate,
      },
      patternStats: {
        totalPatterns: patternStats.totalPatterns,
        avgSuccessRate: patternStats.avgSuccessRate,
      },
      rlInsights: {
        totalSimulations: rlInsights.totalSimulations,
        recommendedTimeframe: rlInsights.recommendedTimeframe,
      },
    };
  }

  async analyzeMarket(
    instrumentToken: number,
    timeframe: string,
    candles: CandleData[]
  ): Promise<MarketContext> {
    return marketContextEngine.analyzeMarketContext(candles, instrumentToken, timeframe);
  }

  async understandStrategy(
    strategyId: number,
    strategy: StrategyAnalysisInput
  ): Promise<StrategyUnderstanding> {
    return semanticStrategyEngine.understandStrategy(strategyId, strategy);
  }

  private adjustRiskForWeakEntry(signal: {
    entryPrice: number;
    stopLoss: number;
    target: number;
  }): { positionSizeMultiplier: number; adjustedStopLoss: number } {
    const originalRisk = Math.abs(signal.entryPrice - signal.stopLoss);
    
    return {
      positionSizeMultiplier: 0.5,
      adjustedStopLoss: signal.entryPrice - originalRisk * 0.8,
    };
  }

  private async logBrainEvent(
    eventType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await supabaseAdmin.from("brain_events").insert({
        event_type: eventType,
        details,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[AIRAIntelligence] Failed to log brain event:", error);
    }
  }

  async shouldBlockTrade(
    instrumentToken: number,
    timeframe: string,
    candles: CandleData[]
  ): Promise<{ blocked: boolean; reason: string }> {
    const context = await marketContextEngine.analyzeMarketContext(
      candles,
      instrumentToken,
      timeframe
    );

    if (context.volatility === "EXTREME") {
      return {
        blocked: true,
        reason: "Extreme volatility detected - waiting for conditions to stabilize",
      };
    }

    if (context.volumeProfile === "VERY_LOW") {
      return {
        blocked: true,
        reason: "Very low volume - insufficient liquidity for safe entry",
      };
    }

    if (context.marketPhase === "DISTRIBUTION" || context.marketPhase === "MARKDOWN") {
      return {
        blocked: false,
        reason: `Market phase: ${context.marketPhase} - proceed with extra caution`,
      };
    }

    return { blocked: false, reason: "Market conditions acceptable" };
  }

  generateTradeSignature(
    indicators: Record<string, number>,
    candles: CandleData[],
    context: MarketContext
  ): string {
    return patternMemoryEngine.generatePatternSignature(
      indicators,
      candles,
      context.regime,
      context.volumeProfile
    );
  }
}

export const airaIntelligence = AIRAIntelligenceOrchestrator.getInstance();
