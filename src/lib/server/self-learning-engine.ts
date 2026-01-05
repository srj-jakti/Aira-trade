import { supabaseAdmin } from "@/lib/supabase/admin";

export interface PatternMetrics {
  patternId: string;
  zairothPattern: string;
  totalOccurrences: number;
  successCount: number;
  failureCount: number;
  avgPnl: number;
  avgWinRate: number;
  lastSeen: Date;
  confidence: number;
}

export interface LearningInsight {
  type: "pattern" | "timing" | "market_condition";
  description: string;
  confidence: number;
  evidence: string[];
  createdAt: Date;
}

class SelfLearningEngine {
  private static instance: SelfLearningEngine;
  private isEnabled: boolean = true;
  private readonly READ_ONLY = true;

  private constructor() {}

  static getInstance(): SelfLearningEngine {
    if (!SelfLearningEngine.instance) {
      SelfLearningEngine.instance = new SelfLearningEngine();
    }
    return SelfLearningEngine.instance;
  }

  async observeBacktestResult(params: {
    strategyId: string;
    userId: string;
    zairothIntent?: string;
    result: {
      netPnl: number;
      winRate: number;
      totalTrades: number;
      maxDrawdown: number;
    };
  }): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await supabaseAdmin.from("learning_observations").insert({
        observation_type: "backtest",
        user_id: params.userId,
        entity_id: params.strategyId,
        zairoth_pattern: params.zairothIntent,
        metrics: {
          netPnl: params.result.netPnl,
          winRate: params.result.winRate,
          totalTrades: params.result.totalTrades,
          maxDrawdown: params.result.maxDrawdown,
        },
        outcome: params.result.netPnl > 0 ? "success" : "failure",
        created_at: new Date().toISOString(),
      });

      if (params.zairothIntent) {
        await this.updatePatternMetrics(params.zairothIntent, params.result.netPnl > 0, params.result);
      }
    } catch (error) {
      console.error("[SelfLearningEngine] Failed to observe backtest:", error);
    }
  }

  async observeTradeOutcome(params: {
    tradeId: string;
    userId: string;
    strategyId: string;
    zairothIntent?: string;
    pnl: number;
    pnlPercentage: number;
    holdingTime: number;
  }): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await supabaseAdmin.from("learning_observations").insert({
        observation_type: "trade",
        user_id: params.userId,
        entity_id: params.tradeId,
        related_entity_id: params.strategyId,
        zairoth_pattern: params.zairothIntent,
        metrics: {
          pnl: params.pnl,
          pnlPercentage: params.pnlPercentage,
          holdingTime: params.holdingTime,
        },
        outcome: params.pnl > 0 ? "success" : "failure",
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[SelfLearningEngine] Failed to observe trade:", error);
    }
  }

  private async updatePatternMetrics(pattern: string, success: boolean, metrics: Record<string, number>): Promise<void> {
    const patternHash = this.hashPattern(pattern);

    const { data: existing } = await supabaseAdmin
      .from("learning_patterns")
      .select("*")
      .eq("pattern_hash", patternHash)
      .single();

    if (existing) {
      const totalOccurrences = existing.total_occurrences + 1;
      const successCount = existing.success_count + (success ? 1 : 0);
      const newAvgPnl = ((existing.avg_pnl * existing.total_occurrences) + (metrics.netPnl || metrics.pnl || 0)) / totalOccurrences;
      const newAvgWinRate = ((existing.avg_win_rate * existing.total_occurrences) + (metrics.winRate || (success ? 100 : 0))) / totalOccurrences;

      await supabaseAdmin
        .from("learning_patterns")
        .update({
          total_occurrences: totalOccurrences,
          success_count: successCount,
          failure_count: totalOccurrences - successCount,
          avg_pnl: newAvgPnl,
          avg_win_rate: newAvgWinRate,
          confidence: successCount / totalOccurrences,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("learning_patterns").insert({
        pattern_hash: patternHash,
        zairoth_pattern: pattern.slice(0, 500),
        total_occurrences: 1,
        success_count: success ? 1 : 0,
        failure_count: success ? 0 : 1,
        avg_pnl: metrics.netPnl || metrics.pnl || 0,
        avg_win_rate: metrics.winRate || (success ? 100 : 0),
        confidence: success ? 1.0 : 0.0,
        last_seen_at: new Date().toISOString(),
      });
    }
  }

  private hashPattern(pattern: string): string {
    let hash = 0;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `pat_${Math.abs(hash).toString(36)}`;
  }

  async getTopPatterns(limit: number = 10): Promise<PatternMetrics[]> {
    const { data } = await supabaseAdmin
      .from("learning_patterns")
      .select("*")
      .gte("total_occurrences", 5)
      .order("confidence", { ascending: false })
      .order("total_occurrences", { ascending: false })
      .limit(limit);

    return (data || []).map((row) => ({
      patternId: row.pattern_hash,
      zairothPattern: row.zairoth_pattern,
      totalOccurrences: row.total_occurrences,
      successCount: row.success_count,
      failureCount: row.failure_count,
      avgPnl: row.avg_pnl,
      avgWinRate: row.avg_win_rate,
      lastSeen: new Date(row.last_seen_at),
      confidence: row.confidence,
    }));
  }

  async generateInsights(): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    const topPatterns = await this.getTopPatterns(5);
    
    for (const pattern of topPatterns) {
      if (pattern.confidence > 0.7 && pattern.totalOccurrences >= 10) {
        insights.push({
          type: "pattern",
          description: `High-confidence pattern detected with ${(pattern.confidence * 100).toFixed(0)}% success rate`,
          confidence: pattern.confidence,
          evidence: [
            `${pattern.totalOccurrences} occurrences`,
            `Avg PnL: ${pattern.avgPnl.toFixed(2)}`,
            `Win Rate: ${pattern.avgWinRate.toFixed(1)}%`,
          ],
          createdAt: new Date(),
        });
      }
    }

    const { data: recentFailures } = await supabaseAdmin
      .from("learning_observations")
      .select("zairoth_pattern")
      .eq("outcome", "failure")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    if (recentFailures && recentFailures.length > 20) {
      insights.push({
        type: "pattern",
        description: `High failure rate detected in recent observations`,
        confidence: 0.6,
        evidence: [`${recentFailures.length} failures in last 7 days`],
        createdAt: new Date(),
      });
    }

    return insights;
  }

  async getLearningStats(): Promise<{
    totalObservations: number;
    successRate: number;
    patternsLearned: number;
    topConfidencePattern: PatternMetrics | null;
  }> {
    const { count: totalObservations } = await supabaseAdmin
      .from("learning_observations")
      .select("*", { count: "exact", head: true });

    const { count: successCount } = await supabaseAdmin
      .from("learning_observations")
      .select("*", { count: "exact", head: true })
      .eq("outcome", "success");

    const { count: patternsLearned } = await supabaseAdmin
      .from("learning_patterns")
      .select("*", { count: "exact", head: true })
      .gte("total_occurrences", 3);

    const topPatterns = await this.getTopPatterns(1);

    return {
      totalObservations: totalObservations || 0,
      successRate: totalObservations ? ((successCount || 0) / totalObservations) * 100 : 0,
      patternsLearned: patternsLearned || 0,
      topConfidencePattern: topPatterns[0] || null,
    };
  }

  canModifyExecution(): boolean {
    return false;
  }

  canModifyStrategy(): boolean {
    return false;
  }

  canModifyCapital(): boolean {
    return false;
  }
}

export const selfLearningEngine = SelfLearningEngine.getInstance();
