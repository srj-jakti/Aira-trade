import { supabaseAdmin } from "@/lib/supabase/admin";
import { airaBrain } from "./aira-brain";
import { MarketRegime } from "./market-context-engine";

export interface StrategyUnderstanding {
  strategyId: number;
  semanticIntent: string;
  coreConcept: string;
  marketConditionsRequired: string[];
  idealRegime: MarketRegime;
  riskProfile: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "SCALPING";
  entryLogicSummary: string;
  exitLogicSummary: string;
  keyIndicators: string[];
  strengths: string[];
  weaknesses: string[];
  humanReadableDescription: string;
  confidenceScore: number;
  strategyType: string;
}

export interface StrategyAnalysisInput {
  name: string;
  description?: string;
  entry: {
    indicators?: Array<{ name: string; params: Record<string, number> }>;
    conditions?: Array<{ field: string; operator: string; value: number | string }>;
    logic?: string;
  };
  exit: {
    indicators?: Array<{ name: string; params: Record<string, number> }>;
    conditions?: Array<{ field: string; operator: string; value: number | string }>;
    logic?: string;
    stopLoss?: number;
    target?: number;
    trailingStop?: number;
  };
  timeframe?: string;
  zairothIntent?: string;
}

class SemanticStrategyEngine {
  private static instance: SemanticStrategyEngine;

  private constructor() {}

  static getInstance(): SemanticStrategyEngine {
    if (!SemanticStrategyEngine.instance) {
      SemanticStrategyEngine.instance = new SemanticStrategyEngine();
    }
    return SemanticStrategyEngine.instance;
  }

  async understandStrategy(
    strategyId: number,
    strategy: StrategyAnalysisInput
  ): Promise<StrategyUnderstanding> {
    const cached = await this.getCachedUnderstanding(strategyId);
    if (cached) return cached;

    const ruleBasedUnderstanding = this.analyzeStrategyRules(strategy);

    const aiUnderstanding = await this.getAIUnderstanding(strategy, ruleBasedUnderstanding);

    const combined: StrategyUnderstanding = {
      strategyId,
      ...ruleBasedUnderstanding,
      ...aiUnderstanding,
      confidenceScore: this.calculateConfidence(ruleBasedUnderstanding, aiUnderstanding),
    };

    await this.saveUnderstanding(combined);

    return combined;
  }

  private analyzeStrategyRules(strategy: StrategyAnalysisInput): Partial<StrategyUnderstanding> {
    const indicators = this.extractIndicators(strategy);
    const strategyType = this.detectStrategyType(strategy, indicators);
    const idealRegime = this.determineIdealRegime(strategyType, strategy);
    const riskProfile = this.assessRiskProfile(strategy);
    const conditions = this.extractConditions(strategy);

    return {
      coreConcept: this.determineConcept(strategyType, indicators),
      strategyType,
      idealRegime,
      riskProfile,
      keyIndicators: indicators,
      marketConditionsRequired: this.deriveMarketConditions(strategyType, conditions),
      entryLogicSummary: this.summarizeEntryLogic(strategy),
      exitLogicSummary: this.summarizeExitLogic(strategy),
      strengths: this.identifyStrengths(strategyType, indicators, strategy),
      weaknesses: this.identifyWeaknesses(strategyType, indicators, strategy),
    };
  }

  private extractIndicators(strategy: StrategyAnalysisInput): string[] {
    const indicators: string[] = [];

    if (strategy.entry?.indicators) {
      indicators.push(...strategy.entry.indicators.map(i => i.name.toUpperCase()));
    }

    if (strategy.exit?.indicators) {
      indicators.push(...strategy.exit.indicators.map(i => i.name.toUpperCase()));
    }

    const searchStr = JSON.stringify(strategy).toLowerCase();
    const commonIndicators = ["rsi", "macd", "ema", "sma", "bollinger", "atr", "adx", "stochastic", "vwap", "obv"];
    for (const ind of commonIndicators) {
      if (searchStr.includes(ind) && !indicators.includes(ind.toUpperCase())) {
        indicators.push(ind.toUpperCase());
      }
    }

    return [...new Set(indicators)];
  }

  private detectStrategyType(strategy: StrategyAnalysisInput, indicators: string[]): string {
    const strategyStr = JSON.stringify(strategy).toLowerCase();
    const intent = strategy.zairothIntent?.toLowerCase() || "";

    if (strategyStr.includes("breakout") || intent.includes("breakout")) {
      return "breakout";
    }

    if (
      (strategyStr.includes("oversold") || strategyStr.includes("overbought")) ||
      (indicators.includes("RSI") && (strategyStr.includes("30") || strategyStr.includes("70")))
    ) {
      return "mean_reversion";
    }

    if (
      indicators.includes("MACD") ||
      (strategyStr.includes("cross") && (indicators.includes("EMA") || indicators.includes("SMA")))
    ) {
      return "trend_following";
    }

    if (
      strategyStr.includes("momentum") ||
      (indicators.includes("RSI") && strategyStr.includes("50"))
    ) {
      return "momentum";
    }

    if (strategyStr.includes("scalp") || strategy.timeframe === "1m" || strategy.timeframe === "5m") {
      return "scalping";
    }

    if (strategyStr.includes("swing") || strategy.timeframe === "1h" || strategy.timeframe === "4h") {
      return "swing_trading";
    }

    return "trend_following";
  }

  private determineIdealRegime(strategyType: string, strategy: StrategyAnalysisInput): MarketRegime {
    const regimeMap: Record<string, MarketRegime> = {
      "trend_following": "UPTREND",
      "momentum": "STRONG_UPTREND",
      "mean_reversion": "SIDEWAYS",
      "breakout": "BREAKOUT_PENDING",
      "scalping": "VOLATILE_BULLISH",
      "swing_trading": "UPTREND",
    };

    const strategyStr = JSON.stringify(strategy).toLowerCase();
    if (strategyStr.includes("short") || strategyStr.includes("bearish")) {
      const bearishMap: Record<string, MarketRegime> = {
        "trend_following": "DOWNTREND",
        "momentum": "STRONG_DOWNTREND",
        "scalping": "VOLATILE_BEARISH",
      };
      return bearishMap[strategyType] || regimeMap[strategyType] || "SIDEWAYS";
    }

    return regimeMap[strategyType] || "SIDEWAYS";
  }

  private assessRiskProfile(strategy: StrategyAnalysisInput): StrategyUnderstanding["riskProfile"] {
    const stopLoss = strategy.exit?.stopLoss || 0;
    const target = strategy.exit?.target || 0;
    const rr = stopLoss > 0 ? target / stopLoss : 0;
    const timeframe = strategy.timeframe || "15m";

    if (timeframe === "1m" || timeframe === "5m") return "SCALPING";
    if (rr >= 3 && stopLoss <= 1) return "CONSERVATIVE";
    if (rr >= 2 || stopLoss <= 2) return "MODERATE";
    return "AGGRESSIVE";
  }

  private extractConditions(strategy: StrategyAnalysisInput): string[] {
    const conditions: string[] = [];

    if (strategy.entry?.conditions) {
      for (const cond of strategy.entry.conditions) {
        conditions.push(`${cond.field} ${cond.operator} ${cond.value}`);
      }
    }

    return conditions;
  }

  private determineConcept(strategyType: string, indicators: string[]): string {
    const concepts: Record<string, string> = {
      "trend_following": "Follow the trend direction using moving average alignment",
      "momentum": "Capture strong directional moves with momentum confirmation",
      "mean_reversion": "Trade price returning to mean after extreme moves",
      "breakout": "Enter on price breaking key support/resistance levels",
      "scalping": "Quick in-and-out trades on minor price fluctuations",
      "swing_trading": "Capture medium-term swings in price movement",
    };

    let concept = concepts[strategyType] || "Custom trading approach";

    if (indicators.length > 0) {
      concept += ` using ${indicators.slice(0, 3).join(", ")}`;
    }

    return concept;
  }

  private deriveMarketConditions(strategyType: string, conditions: string[]): string[] {
    const baseConditions: Record<string, string[]> = {
      "trend_following": ["Clear directional trend", "Price above/below key EMAs", "Volume confirming direction"],
      "momentum": ["Strong price momentum", "RSI showing strength", "Volume expansion"],
      "mean_reversion": ["Range-bound market", "RSI at extremes", "Price at support/resistance"],
      "breakout": ["Consolidation period ending", "Volume building up", "Key level proximity"],
      "scalping": ["High liquidity", "Tight spreads", "Volatile but predictable"],
      "swing_trading": ["Clear swing structure", "Multi-timeframe alignment", "Key levels identified"],
    };

    return baseConditions[strategyType] || ["Market conditions suitable for strategy"];
  }

  private summarizeEntryLogic(strategy: StrategyAnalysisInput): string {
    const parts: string[] = [];

    if (strategy.entry?.conditions) {
      for (const cond of strategy.entry.conditions.slice(0, 3)) {
        parts.push(`${cond.field} ${cond.operator} ${cond.value}`);
      }
    }

    if (strategy.entry?.logic) {
      parts.push(strategy.entry.logic);
    }

    if (strategy.zairothIntent) {
      return strategy.zairothIntent;
    }

    return parts.length > 0 ? `Enter when: ${parts.join(" AND ")}` : "Entry conditions not specified";
  }

  private summarizeExitLogic(strategy: StrategyAnalysisInput): string {
    const parts: string[] = [];

    if (strategy.exit?.stopLoss) {
      parts.push(`Stop Loss: ${strategy.exit.stopLoss}%`);
    }

    if (strategy.exit?.target) {
      parts.push(`Target: ${strategy.exit.target}%`);
    }

    if (strategy.exit?.trailingStop) {
      parts.push(`Trailing Stop: ${strategy.exit.trailingStop}%`);
    }

    if (strategy.exit?.conditions) {
      for (const cond of strategy.exit.conditions.slice(0, 2)) {
        parts.push(`${cond.field} ${cond.operator} ${cond.value}`);
      }
    }

    return parts.length > 0 ? parts.join(", ") : "Exit on stop loss or target";
  }

  private identifyStrengths(strategyType: string, indicators: string[], strategy: StrategyAnalysisInput): string[] {
    const strengths: string[] = [];

    if (indicators.length >= 2) {
      strengths.push("Multiple indicator confirmation reduces false signals");
    }

    if (strategy.exit?.stopLoss && strategy.exit.stopLoss <= 2) {
      strengths.push("Tight risk management with defined stop loss");
    }

    if (strategy.exit?.trailingStop) {
      strengths.push("Trailing stop protects profits while letting winners run");
    }

    const strengthsByType: Record<string, string[]> = {
      "trend_following": ["Works well in trending markets", "Captures large moves"],
      "momentum": ["High win rate in strong trends", "Quick profits"],
      "mean_reversion": ["High probability setups", "Clear entry/exit points"],
      "breakout": ["Catches the start of big moves", "Clear invalidation levels"],
    };

    strengths.push(...(strengthsByType[strategyType] || []));

    return strengths.slice(0, 5);
  }

  private identifyWeaknesses(strategyType: string, indicators: string[], strategy: StrategyAnalysisInput): string[] {
    const weaknesses: string[] = [];

    if (indicators.length > 4) {
      weaknesses.push("Too many indicators may cause analysis paralysis");
    }

    if (!strategy.exit?.stopLoss) {
      weaknesses.push("No defined stop loss - unlimited downside risk");
    }

    const weaknessesByType: Record<string, string[]> = {
      "trend_following": ["Whipsaws in sideways markets", "Late entries miss initial move"],
      "momentum": ["Can catch falling knives", "Needs strong conviction"],
      "mean_reversion": ["Fails in strong trends", "Can fight momentum too early"],
      "breakout": ["Many false breakouts", "Requires volume confirmation"],
    };

    weaknesses.push(...(weaknessesByType[strategyType] || []));

    return weaknesses.slice(0, 5);
  }

  private async getAIUnderstanding(
    strategy: StrategyAnalysisInput,
    ruleBasedAnalysis: Partial<StrategyUnderstanding>
  ): Promise<Partial<StrategyUnderstanding>> {
    try {
      const prompt = `You are an expert quantitative trader. Analyze this trading strategy and provide deep understanding.

STRATEGY:
Name: ${strategy.name}
Intent: ${strategy.zairothIntent || "Not specified"}
Entry: ${JSON.stringify(strategy.entry)}
Exit: ${JSON.stringify(strategy.exit)}
Timeframe: ${strategy.timeframe || "15m"}

INITIAL ANALYSIS:
Type: ${ruleBasedAnalysis.strategyType}
Core Concept: ${ruleBasedAnalysis.coreConcept}
Ideal Regime: ${ruleBasedAnalysis.idealRegime}

Provide a JSON response with:
{
  "semanticIntent": "What the trader is trying to achieve in plain English",
  "humanReadableDescription": "A paragraph explaining how this strategy works as if explaining to a new trader",
  "additionalStrengths": ["strength1", "strength2"],
  "additionalWeaknesses": ["weakness1", "weakness2"],
  "bestMarketConditions": ["condition1", "condition2"],
  "worstMarketConditions": ["condition1", "condition2"]
}`;

      const result = await airaBrain.executeAnalysis(
        "strategy_understanding",
        [{ role: "user", content: prompt }],
        { maxTokens: 500 }
      );

      if (result.success && result.result) {
        const parsed = typeof result.result === "string"
          ? JSON.parse(result.result.replace(/```json\n?|\n?```/g, ""))
          : result.result;

        return {
          semanticIntent: parsed.semanticIntent || ruleBasedAnalysis.coreConcept,
          humanReadableDescription: parsed.humanReadableDescription || "",
          strengths: [...(ruleBasedAnalysis.strengths || []), ...(parsed.additionalStrengths || [])].slice(0, 5),
          weaknesses: [...(ruleBasedAnalysis.weaknesses || []), ...(parsed.additionalWeaknesses || [])].slice(0, 5),
          marketConditionsRequired: [
            ...(ruleBasedAnalysis.marketConditionsRequired || []),
            ...(parsed.bestMarketConditions || []),
          ].slice(0, 5),
        };
      }
    } catch (error) {
      console.error("[SemanticStrategyEngine] AI understanding failed:", error);
    }

    return {
      semanticIntent: ruleBasedAnalysis.coreConcept || "Trading strategy",
      humanReadableDescription: `This is a ${ruleBasedAnalysis.strategyType} strategy that works best in ${ruleBasedAnalysis.idealRegime} conditions.`,
    };
  }

  private calculateConfidence(
    ruleBasedAnalysis: Partial<StrategyUnderstanding>,
    aiAnalysis: Partial<StrategyUnderstanding>
  ): number {
    let confidence = 0.5;

    if (ruleBasedAnalysis.keyIndicators && ruleBasedAnalysis.keyIndicators.length >= 2) {
      confidence += 0.1;
    }

    if (ruleBasedAnalysis.entryLogicSummary && ruleBasedAnalysis.entryLogicSummary.length > 20) {
      confidence += 0.1;
    }

    if (ruleBasedAnalysis.exitLogicSummary && ruleBasedAnalysis.exitLogicSummary.includes("Stop")) {
      confidence += 0.1;
    }

    if (aiAnalysis.semanticIntent && aiAnalysis.semanticIntent.length > 30) {
      confidence += 0.1;
    }

    if (aiAnalysis.humanReadableDescription && aiAnalysis.humanReadableDescription.length > 50) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  private async getCachedUnderstanding(strategyId: number): Promise<StrategyUnderstanding | null> {
    try {
      const { data } = await supabaseAdmin
        .from("strategy_understanding")
        .select("*")
        .eq("strategy_id", strategyId)
        .single();

      if (!data) return null;

      return {
        strategyId: data.strategy_id,
        semanticIntent: data.semantic_intent,
        coreConcept: data.core_concept,
        marketConditionsRequired: data.market_conditions_required,
        idealRegime: data.ideal_regime as MarketRegime,
        riskProfile: data.risk_profile as StrategyUnderstanding["riskProfile"],
        entryLogicSummary: data.entry_logic_summary,
        exitLogicSummary: data.exit_logic_summary,
        keyIndicators: data.key_indicators,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        humanReadableDescription: data.human_readable_description,
        confidenceScore: data.confidence_score,
        strategyType: data.core_concept?.split(" ")[0]?.toLowerCase() || "unknown",
      };
    } catch {
      return null;
    }
  }

  private async saveUnderstanding(understanding: StrategyUnderstanding): Promise<void> {
    try {
      await supabaseAdmin
        .from("strategy_understanding")
        .upsert({
          strategy_id: understanding.strategyId,
          semantic_intent: understanding.semanticIntent,
          core_concept: understanding.coreConcept,
          market_conditions_required: understanding.marketConditionsRequired,
          ideal_regime: understanding.idealRegime,
          risk_profile: understanding.riskProfile,
          entry_logic_summary: understanding.entryLogicSummary,
          exit_logic_summary: understanding.exitLogicSummary,
          key_indicators: understanding.keyIndicators,
          strengths: understanding.strengths,
          weaknesses: understanding.weaknesses,
          human_readable_description: understanding.humanReadableDescription,
          confidence_score: understanding.confidenceScore,
          updated_at: new Date().toISOString(),
        }, { onConflict: "strategy_id" });
    } catch (error) {
      console.error("[SemanticStrategyEngine] Failed to save understanding:", error);
    }
  }

  isStrategyMatchingConditions(
    understanding: StrategyUnderstanding,
    currentRegime: MarketRegime,
    currentVolatility: string
  ): { matches: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 50;

    const trendingRegimes: MarketRegime[] = ["STRONG_UPTREND", "UPTREND", "STRONG_DOWNTREND", "DOWNTREND"];
    const rangingRegimes: MarketRegime[] = ["SIDEWAYS", "CONSOLIDATION"];
    const volatileRegimes: MarketRegime[] = ["VOLATILE_BULLISH", "VOLATILE_BEARISH"];

    const idealIsTrending = trendingRegimes.includes(understanding.idealRegime);
    const currentIsTrending = trendingRegimes.includes(currentRegime);
    const idealIsRanging = rangingRegimes.includes(understanding.idealRegime);
    const currentIsRanging = rangingRegimes.includes(currentRegime);

    if (understanding.idealRegime === currentRegime) {
      score += 40;
      reasons.push(`Perfect regime match: ${currentRegime}`);
    } else if (
      (idealIsTrending && currentIsTrending) ||
      (idealIsRanging && currentIsRanging)
    ) {
      score += 25;
      reasons.push(`Compatible regime: ${currentRegime} works for ${understanding.strategyType}`);
    } else {
      score -= 20;
      reasons.push(`Regime mismatch: Strategy needs ${understanding.idealRegime}, current is ${currentRegime}`);
    }

    if (understanding.strategyType === "scalping" && (currentVolatility === "HIGH" || currentVolatility === "EXTREME")) {
      score += 10;
      reasons.push("High volatility favors scalping");
    } else if (understanding.strategyType === "swing_trading" && currentVolatility === "EXTREME") {
      score -= 15;
      reasons.push("Extreme volatility risky for swing trading");
    }

    return {
      matches: score >= 60,
      score: Math.min(100, Math.max(0, score)),
      reasons,
    };
  }
}

export const semanticStrategyEngine = SemanticStrategyEngine.getInstance();
