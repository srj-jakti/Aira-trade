import { supabaseAdmin } from "@/lib/supabase/admin";
import { MarketRegime, MarketContext } from "./market-context-engine";

export interface PatternSignature {
  indicators: Record<string, number>;
  candlePattern: string;
  regimeAtEntry: MarketRegime;
  volumeProfile: string;
  priceAction: string;
}

export interface StoredPattern {
  id: number;
  patternSignature: string;
  instrumentToken?: number;
  timeframe: string;
  marketRegime: MarketRegime;
  entryConditions: PatternSignature;
  outcome: "PROFIT" | "LOSS" | "BREAKEVEN";
  pnlResult: number;
  riskRewardAchieved: number;
  holdingDurationMinutes: number;
  occurrenceCount: number;
  successRate: number;
  avgPnl: number;
}

export interface PatternMatch {
  pattern: StoredPattern;
  similarity: number;
  expectedOutcome: "PROFIT" | "LOSS" | "UNCERTAIN";
  expectedPnl: number;
  confidence: number;
  recommendation: string;
}

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class PatternMemoryEngine {
  private static instance: PatternMemoryEngine;

  private constructor() {}

  static getInstance(): PatternMemoryEngine {
    if (!PatternMemoryEngine.instance) {
      PatternMemoryEngine.instance = new PatternMemoryEngine();
    }
    return PatternMemoryEngine.instance;
  }

  generatePatternSignature(
    indicators: Record<string, number>,
    candles: CandleData[],
    regime: MarketRegime,
    volumeProfile: string
  ): string {
    const normalizedIndicators = this.normalizeIndicators(indicators);
    const candlePattern = this.detectCandlePattern(candles);
    const priceAction = this.analyzePriceAction(candles);

    const components = [
      `regime:${regime}`,
      `candle:${candlePattern}`,
      `volume:${volumeProfile}`,
      `action:${priceAction}`,
      ...Object.entries(normalizedIndicators).map(([k, v]) => `${k}:${v}`),
    ];

    return components.sort().join("|");
  }

  private normalizeIndicators(indicators: Record<string, number>): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(indicators)) {
      const lowerKey = key.toLowerCase();

      if (lowerKey.includes("rsi")) {
        if (value < 20) normalized.rsi = "extreme_oversold";
        else if (value < 30) normalized.rsi = "oversold";
        else if (value < 45) normalized.rsi = "weak";
        else if (value < 55) normalized.rsi = "neutral";
        else if (value < 70) normalized.rsi = "strong";
        else if (value < 80) normalized.rsi = "overbought";
        else normalized.rsi = "extreme_overbought";
      } else if (lowerKey.includes("macd")) {
        if (value > 0.5) normalized.macd = "strong_bullish";
        else if (value > 0) normalized.macd = "bullish";
        else if (value > -0.5) normalized.macd = "bearish";
        else normalized.macd = "strong_bearish";
      } else if (lowerKey.includes("adx")) {
        if (value < 20) normalized.adx = "no_trend";
        else if (value < 40) normalized.adx = "trend";
        else normalized.adx = "strong_trend";
      } else if (lowerKey.includes("momentum") || lowerKey.includes("mom")) {
        if (value > 2) normalized.momentum = "strong_up";
        else if (value > 0) normalized.momentum = "up";
        else if (value > -2) normalized.momentum = "down";
        else normalized.momentum = "strong_down";
      }
    }

    return normalized;
  }

  private detectCandlePattern(candles: CandleData[]): string {
    if (candles.length < 3) return "unknown";

    const recent = candles.slice(-3);
    const [prev2, prev1, current] = recent;

    const currentBody = Math.abs(current.close - current.open);
    const currentRange = current.high - current.low;
    const currentUpperWick = current.high - Math.max(current.open, current.close);
    const currentLowerWick = Math.min(current.open, current.close) - current.low;

    const isBullish = current.close > current.open;
    const isBearish = current.close < current.open;
    const isSmallBody = currentBody < currentRange * 0.3;
    const isLargeBody = currentBody > currentRange * 0.7;

    if (isSmallBody && currentLowerWick > currentBody * 2 && isBullish) {
      return "hammer";
    }
    if (isSmallBody && currentUpperWick > currentBody * 2 && isBearish) {
      return "shooting_star";
    }

    if (isSmallBody && currentUpperWick > currentBody && currentLowerWick > currentBody) {
      return "doji";
    }

    if (prev1.close < prev1.open && isBullish && current.close > prev1.open && current.open < prev1.close) {
      return "bullish_engulfing";
    }
    if (prev1.close > prev1.open && isBearish && current.close < prev1.open && current.open > prev1.close) {
      return "bearish_engulfing";
    }

    if (isLargeBody && isBullish) return "bullish_marubozu";
    if (isLargeBody && isBearish) return "bearish_marubozu";

    if (isBullish) return "bullish_candle";
    if (isBearish) return "bearish_candle";

    return "neutral";
  }

  private analyzePriceAction(candles: CandleData[]): string {
    if (candles.length < 5) return "insufficient_data";

    const recent = candles.slice(-5);
    const closes = recent.map(c => c.close);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);

    const higherHighs = highs.filter((h, i) => i > 0 && h > highs[i - 1]).length;
    const higherLows = lows.filter((l, i) => i > 0 && l > lows[i - 1]).length;
    const lowerHighs = highs.filter((h, i) => i > 0 && h < highs[i - 1]).length;
    const lowerLows = lows.filter((l, i) => i > 0 && l < lows[i - 1]).length;

    if (higherHighs >= 3 && higherLows >= 3) return "strong_uptrend";
    if (lowerHighs >= 3 && lowerLows >= 3) return "strong_downtrend";
    if (higherHighs >= 2 && higherLows >= 2) return "uptrend";
    if (lowerHighs >= 2 && lowerLows >= 2) return "downtrend";

    const range = Math.max(...highs) - Math.min(...lows);
    const avgPrice = closes.reduce((s, c) => s + c, 0) / closes.length;
    const rangePercent = (range / avgPrice) * 100;

    if (rangePercent < 1) return "tight_consolidation";
    if (rangePercent < 2) return "consolidation";

    return "choppy";
  }

  async findSimilarPatterns(
    currentSignature: string,
    instrumentToken: number | null,
    timeframe: string,
    limit: number = 10
  ): Promise<PatternMatch[]> {
    try {
      let query = supabaseAdmin
        .from("pattern_memory")
        .select("*")
        .eq("timeframe", timeframe)
        .gte("occurrence_count", 3)
        .order("success_rate", { ascending: false })
        .limit(50);

      if (instrumentToken) {
        query = query.or(`instrument_token.eq.${instrumentToken},instrument_token.is.null`);
      }

      const { data: patterns } = await query;

      if (!patterns || patterns.length === 0) {
        return [];
      }

      const matches: PatternMatch[] = [];

      for (const pattern of patterns) {
        const similarity = this.calculateSimilarity(currentSignature, pattern.pattern_signature);
        
        if (similarity >= 0.5) {
          const successRate = pattern.success_rate || 0;
          const avgPnl = pattern.avg_pnl || 0;

          let expectedOutcome: "PROFIT" | "LOSS" | "UNCERTAIN" = "UNCERTAIN";
          if (successRate >= 60 && avgPnl > 0) expectedOutcome = "PROFIT";
          else if (successRate <= 40 || avgPnl < 0) expectedOutcome = "LOSS";

          const confidence = (similarity * 0.4 + (successRate / 100) * 0.4 + Math.min(1, pattern.occurrence_count / 20) * 0.2);

          let recommendation = "Proceed with caution";
          if (expectedOutcome === "PROFIT" && confidence >= 0.7) {
            recommendation = "High probability setup - consider entry";
          } else if (expectedOutcome === "PROFIT" && confidence >= 0.5) {
            recommendation = "Moderate probability - use tight risk management";
          } else if (expectedOutcome === "LOSS") {
            recommendation = "Historical pattern suggests avoiding this setup";
          }

          matches.push({
            pattern: {
              id: pattern.id,
              patternSignature: pattern.pattern_signature,
              instrumentToken: pattern.instrument_token,
              timeframe: pattern.timeframe,
              marketRegime: pattern.market_regime,
              entryConditions: pattern.entry_conditions,
              outcome: pattern.outcome,
              pnlResult: pattern.pnl_result,
              riskRewardAchieved: pattern.risk_reward_achieved,
              holdingDurationMinutes: pattern.holding_duration_minutes,
              occurrenceCount: pattern.occurrence_count,
              successRate: pattern.success_rate,
              avgPnl: pattern.avg_pnl,
            },
            similarity,
            expectedOutcome,
            expectedPnl: avgPnl * similarity,
            confidence,
            recommendation,
          });
        }
      }

      return matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit);
    } catch (error) {
      console.error("[PatternMemoryEngine] Failed to find similar patterns:", error);
      return [];
    }
  }

  private calculateSimilarity(sig1: string, sig2: string): number {
    const parts1 = new Set(sig1.split("|"));
    const parts2 = new Set(sig2.split("|"));

    const intersection = new Set([...parts1].filter(x => parts2.has(x)));
    const union = new Set([...parts1, ...parts2]);

    return intersection.size / union.size;
  }

  async recordPattern(
    signature: string,
    instrumentToken: number | null,
    timeframe: string,
    regime: MarketRegime,
    entryConditions: PatternSignature,
    outcome: "PROFIT" | "LOSS" | "BREAKEVEN",
    pnl: number,
    riskReward: number,
    holdingMinutes: number
  ): Promise<void> {
    try {
      const { data: existing } = await supabaseAdmin
        .from("pattern_memory")
        .select("*")
        .eq("pattern_signature", signature)
        .eq("timeframe", timeframe)
        .maybeSingle();

      if (existing) {
        const newCount = existing.occurrence_count + 1;
        const newAvgPnl = (existing.avg_pnl * existing.occurrence_count + pnl) / newCount;
        const profitCount = outcome === "PROFIT" 
          ? (existing.success_rate / 100 * existing.occurrence_count) + 1
          : existing.success_rate / 100 * existing.occurrence_count;
        const newSuccessRate = (profitCount / newCount) * 100;

        await supabaseAdmin
          .from("pattern_memory")
          .update({
            occurrence_count: newCount,
            success_rate: newSuccessRate,
            avg_pnl: newAvgPnl,
            outcome: newSuccessRate >= 50 ? "PROFIT" : "LOSS",
            last_occurred_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("pattern_memory").insert({
          pattern_signature: signature,
          instrument_token: instrumentToken,
          timeframe,
          market_regime: regime,
          entry_conditions: entryConditions,
          outcome,
          pnl_result: pnl,
          risk_reward_achieved: riskReward,
          holding_duration_minutes: holdingMinutes,
          occurrence_count: 1,
          success_rate: outcome === "PROFIT" ? 100 : 0,
          avg_pnl: pnl,
          similarity_vector: { signature_parts: signature.split("|") },
        });
      }
    } catch (error) {
      console.error("[PatternMemoryEngine] Failed to record pattern:", error);
    }
  }

  async getPatternStats(
    regime: MarketRegime,
    timeframe: string
  ): Promise<{
    totalPatterns: number;
    avgSuccessRate: number;
    bestPattern: StoredPattern | null;
    worstPattern: StoredPattern | null;
  }> {
    try {
      const { data: patterns } = await supabaseAdmin
        .from("pattern_memory")
        .select("*")
        .eq("market_regime", regime)
        .eq("timeframe", timeframe)
        .gte("occurrence_count", 3);

      if (!patterns || patterns.length === 0) {
        return { totalPatterns: 0, avgSuccessRate: 0, bestPattern: null, worstPattern: null };
      }

      const avgSuccessRate = patterns.reduce((sum, p) => sum + (p.success_rate || 0), 0) / patterns.length;
      
      const sortedBySuccess = [...patterns].sort((a, b) => (b.success_rate || 0) - (a.success_rate || 0));
      const best = sortedBySuccess[0];
      const worst = sortedBySuccess[sortedBySuccess.length - 1];

      const mapPattern = (p: typeof patterns[0]): StoredPattern => ({
        id: p.id,
        patternSignature: p.pattern_signature,
        instrumentToken: p.instrument_token,
        timeframe: p.timeframe,
        marketRegime: p.market_regime,
        entryConditions: p.entry_conditions,
        outcome: p.outcome,
        pnlResult: p.pnl_result,
        riskRewardAchieved: p.risk_reward_achieved,
        holdingDurationMinutes: p.holding_duration_minutes,
        occurrenceCount: p.occurrence_count,
        successRate: p.success_rate,
        avgPnl: p.avg_pnl,
      });

      return {
        totalPatterns: patterns.length,
        avgSuccessRate,
        bestPattern: mapPattern(best),
        worstPattern: mapPattern(worst),
      };
    } catch (error) {
      console.error("[PatternMemoryEngine] Failed to get pattern stats:", error);
      return { totalPatterns: 0, avgSuccessRate: 0, bestPattern: null, worstPattern: null };
    }
  }

  async getTradeRecommendation(
    indicators: Record<string, number>,
    candles: CandleData[],
    context: MarketContext,
    instrumentToken: number | null,
    timeframe: string
  ): Promise<{
    shouldTrade: boolean;
    confidence: number;
    reason: string;
    similarPatterns: PatternMatch[];
  }> {
    const signature = this.generatePatternSignature(
      indicators,
      candles,
      context.regime,
      context.volumeProfile
    );

    const similarPatterns = await this.findSimilarPatterns(
      signature,
      instrumentToken,
      timeframe,
      5
    );

    if (similarPatterns.length === 0) {
      return {
        shouldTrade: true,
        confidence: 0.5,
        reason: "No historical pattern data - proceed with standard risk management",
        similarPatterns: [],
      };
    }

    const avgConfidence = similarPatterns.reduce((sum, p) => sum + p.confidence, 0) / similarPatterns.length;
    const profitPatterns = similarPatterns.filter(p => p.expectedOutcome === "PROFIT").length;
    const lossPatterns = similarPatterns.filter(p => p.expectedOutcome === "LOSS").length;

    let shouldTrade = true;
    let reason = "";

    if (lossPatterns > profitPatterns && avgConfidence < 0.5) {
      shouldTrade = false;
      reason = `Historical patterns (${lossPatterns}/${similarPatterns.length}) suggest this setup has poor outcomes`;
    } else if (profitPatterns > lossPatterns && avgConfidence >= 0.6) {
      shouldTrade = true;
      reason = `Strong historical support: ${profitPatterns}/${similarPatterns.length} similar patterns were profitable`;
    } else {
      shouldTrade = true;
      reason = `Mixed historical results - use tight risk management`;
    }

    return {
      shouldTrade,
      confidence: avgConfidence,
      reason,
      similarPatterns,
    };
  }
}

export const patternMemoryEngine = PatternMemoryEngine.getInstance();
