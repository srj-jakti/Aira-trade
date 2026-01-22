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
    const marketContext = this.analyzeMarketContext(candles);

    const recentCandles = candles.slice(-50);
    const candlesData = recentCandles.map(c => ({
      o: c.open.toFixed(2),
      h: c.high.toFixed(2),
      l: c.low.toFixed(2),
      c: c.close.toFixed(2),
      v: c.volume
    }));

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
    - Resistance: ${marketContext.keyLevels.resistance.slice(0, 3).join(', ')}

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
