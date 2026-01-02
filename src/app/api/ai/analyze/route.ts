import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { aiSharedService } from "@/lib/server/ai-shared-service";
import { getLiveCandles, getLatestTick } from "@/lib/server/market-data-engine";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { instrumentToken, tradingsymbol, timeframe = "5m" } = body;

    if (!instrumentToken || !tradingsymbol) {
      return badRequestResponse("instrumentToken and tradingsymbol are required");
    }

    const candles = await getLiveCandles(
      parseInt(instrumentToken),
      timeframe,
      200
    );

    const latestTick = await getLatestTick(parseInt(instrumentToken));

    if (candles.length === 0) {
      return NextResponse.json({
        success: true,
        analysis: {
          trend: "neutral",
          strength: 0,
          support: null,
          resistance: null,
          analysis: "No live data available. Please ensure market data worker is running and connected.",
          signal: "hold",
          confidence: 0,
          entry: null,
          target: null,
          stopLoss: null,
          reasoning: "Waiting for live market data",
        },
        hasData: false,
        dataSource: "LIVE",
      });
    }

    const marketAnalysis = await aiSharedService.analyzeMarketTrend({
      symbol: tradingsymbol,
      candles,
    });

    const signalAnalysis = await aiSharedService.generateSignal({
      symbol: tradingsymbol,
      candles,
    });

    const parseAIResponse = (response: any) => {
      if (!response.success || !response.result) return null;
      
      let content = response.result;
      if (typeof content !== "string") return content;

      // Strip markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1];
      }

      try {
        return JSON.parse(content.trim());
      } catch (e) {
        console.error("Failed to parse AI JSON:", e);
        return null;
      }
    };

    let trendResult = {
      trend: "neutral",
      strength: 50,
      support: null as number | null,
      resistance: null as number | null,
      analysis: "Analysis in progress...",
    };

    let signalResult = {
      signal: "hold",
      confidence: 50,
      entry: null as number | null,
      target: null as number | null,
      stopLoss: null as number | null,
      reasoning: "Signal generation in progress...",
    };

    const parsedTrend = parseAIResponse(marketAnalysis);
    if (parsedTrend) {
      trendResult = { ...trendResult, ...parsedTrend };
    } else if (typeof marketAnalysis.result === "string") {
      trendResult.analysis = marketAnalysis.result;
    }

    const parsedSignal = parseAIResponse(signalAnalysis);
    if (parsedSignal) {
      signalResult = { ...signalResult, ...parsedSignal };
    } else if (typeof signalAnalysis.result === "string") {
      signalResult.reasoning = signalAnalysis.result;
    }

    if (!marketAnalysis.success && !signalAnalysis.success) {
      const recentCandles = candles.slice(-30);
      const prices = recentCandles.map(c => c.close);
      const highs = recentCandles.map(c => c.high);
      const lows = recentCandles.map(c => c.low);
      
      const currentPrice = prices[prices.length - 1];
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const maxHigh = Math.max(...highs);
      const minLow = Math.min(...lows);
      
      const priceChange = ((currentPrice - prices[0]) / prices[0]) * 100;
      
      trendResult = {
        trend: priceChange > 2 ? "bullish" : priceChange < -2 ? "bearish" : "neutral",
        strength: Math.min(100, Math.abs(priceChange) * 10),
        support: minLow,
        resistance: maxHigh,
        analysis: `Based on ${recentCandles.length} days of data: Price ${priceChange > 0 ? "up" : "down"} ${Math.abs(priceChange).toFixed(2)}%. Current: ${currentPrice.toFixed(2)}, Avg: ${avgPrice.toFixed(2)}.`,
      };

      signalResult = {
        signal: priceChange > 3 ? "buy" : priceChange < -3 ? "sell" : "hold",
        confidence: Math.min(80, 50 + Math.abs(priceChange) * 5),
        entry: currentPrice,
        target: currentPrice * (priceChange > 0 ? 1.05 : 0.95),
        stopLoss: currentPrice * (priceChange > 0 ? 0.97 : 1.03),
        reasoning: `Technical analysis based on recent price movement of ${priceChange.toFixed(2)}%.`,
      };
    }

    return NextResponse.json({
      success: true,
      analysis: {
        ...trendResult,
        ...signalResult,
      },
      hasData: true,
      dataPoints: candles.length,
      dataSource: "LIVE",
      latestPrice: latestTick?.lastPrice || candles[candles.length - 1]?.close,
      aiProvider: marketAnalysis.provider || signalAnalysis.provider || "fallback",
      cached: marketAnalysis.cached || signalAnalysis.cached,
    });
  } catch (error) {
    console.error("AI Analysis error:", error);
    return serverErrorResponse();
  }
}
