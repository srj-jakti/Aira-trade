import { supabase } from "./utils/supabase";
import { logger } from "./utils/logger";

export interface RLScore {
  score: number;
  recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "AVOID" | "STRONG_AVOID";
  reasoning: string;
  confidence: number;
}

export async function getRLScoreForInstrument(
  instrumentToken: number,
  patternType: string,
  timeframe: string,
  marketConditions: { trend: string; volatility: string }
): Promise<RLScore> {
  try {
    const { data: profitability } = await supabase
      .from("instrument_profitability_knowledge")
      .select("*")
      .eq("instrument_token", instrumentToken)
      .eq("pattern_type", patternType)
      .eq("timeframe", timeframe)
      .single();

    const { data: globalWeights } = await supabase
      .from("rl_global_weights")
      .select("weights")
      .eq("id", "global_v1")
      .single();

    let patternMatch = 50;
    let historicalProfitability = 50;
    let currentConditionMatch = 50;

    if (profitability) {
      patternMatch = Math.min(100, profitability.confidence * 100);
      historicalProfitability = Math.min(100, profitability.profitability_score);

      if (marketConditions.trend === "UPTREND" && profitability.trend_following_score > 60) {
        currentConditionMatch = 80;
      } else if (marketConditions.trend === "SIDEWAYS" && profitability.mean_reversion_score > 60) {
        currentConditionMatch = 75;
      }
    }

    if (globalWeights?.weights?.optimized_params_avg?.preferred_timeframe === timeframe) {
      patternMatch += 10;
    }

    const totalScore =
      patternMatch * 0.25 +
      historicalProfitability * 0.35 +
      currentConditionMatch * 0.2 +
      70 * 0.1 +
      60 * 0.1;

    let recommendation: RLScore["recommendation"] = "NEUTRAL";
    if (totalScore >= 80) recommendation = "STRONG_BUY";
    else if (totalScore >= 65) recommendation = "BUY";
    else if (totalScore >= 45) recommendation = "NEUTRAL";
    else if (totalScore >= 30) recommendation = "AVOID";
    else recommendation = "STRONG_AVOID";

    const reasoning = profitability
      ? `RL Score: ${totalScore.toFixed(0)}/100. Win rate: ${profitability.avg_win_rate?.toFixed(0)}%. ${profitability.total_signals} historical signals.`
      : `No historical data for this pattern/timeframe combination.`;

    return {
      score: Math.round(totalScore * 100) / 100,
      recommendation,
      reasoning,
      confidence: profitability?.confidence || 0,
    };
  } catch (error) {
    logger.error("RL scoring failed:", error);
    return {
      score: 50,
      recommendation: "NEUTRAL",
      reasoning: "RL scoring unavailable",
      confidence: 0,
    };
  }
}

export async function updateRLKnowledgeAfterTrade(
  instrumentToken: number,
  tradingSymbol: string,
  patternType: string,
  timeframe: string,
  tradeResult: {
    pnl: number;
    isProfit: boolean;
    riskReward: number;
    marketCondition: string;
  }
): Promise<void> {
  try {
    const { data: existing } = await supabase
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

      const profitabilityScore = calculateProfitabilityScore(newWinRate, newAvgPnl, newAvgRR, newTotalSignals);
      const confidence = Math.min(1, newTotalSignals / 20);

      await supabase
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
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      const winRate = tradeResult.isProfit ? 100 : 0;
      const profitabilityScore = calculateProfitabilityScore(winRate, tradeResult.pnl, tradeResult.riskReward, 1);

      await supabase.from("instrument_profitability_knowledge").insert({
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
      });
    }

    logger.info(`[RL] Updated knowledge for ${tradingSymbol} ${patternType} ${timeframe}`);
  } catch (error) {
    logger.error("Failed to update RL knowledge:", error);
  }
}

function calculateProfitabilityScore(
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

export function extractPatternType(strategyIntent: string): string {
  const lower = strategyIntent.toLowerCase();
  
  if (lower.includes("rsi") && lower.includes("oversold")) return "rsi_oversold";
  if (lower.includes("rsi") && lower.includes("overbought")) return "rsi_overbought";
  if (lower.includes("macd") && lower.includes("cross")) return "macd_crossover";
  if (lower.includes("ema") && lower.includes("cross")) return "ema_crossover";
  if (lower.includes("breakout")) return "breakout";
  if (lower.includes("reversal")) return "reversal";
  if (lower.includes("momentum")) return "momentum";
  if (lower.includes("support") || lower.includes("resistance")) return "sr_bounce";
  
  return "generic";
}
