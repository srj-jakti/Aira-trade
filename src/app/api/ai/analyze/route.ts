import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { aiSharedService } from "@/lib/server/ai-shared-service";
import { getCandlesForAI, validateCandleMode } from "@/lib/server/candle-service";
import { getLatestTick } from "@/lib/server/market-data-engine";
import { logInstrumentSearch } from "@/lib/server/dynamic-instrument-manager";
import { checkAILimit, logAIUsage } from "@/lib/server/ai-usage";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/ai/analyze
 * 
 * Performs Human-Like AI-powered market analysis on an instrument.
 * Uses Live-Historical data from live_candles for proper context.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    // 1. Get user's subscription plan for limit checking
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", user.userId)
      .single();
    
    const planId = sub?.plan_id || "basic";

    // 2. Check limits
    const limitCheck = await checkAILimit(user.userId, planId);
    if (!limitCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: limitCheck.reason,
        usage: limitCheck.usage
      }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return badRequestResponse("Invalid JSON in request body");
    }
    
    const { instrumentToken, tradingsymbol, exchange = "NSE", timeframe = "5m" } = body;

    if (!instrumentToken || !tradingsymbol) {
      return badRequestResponse("instrumentToken and tradingsymbol are required");
    }

    // Log instrument search for dynamic subscription
    logInstrumentSearch(
      parseInt(instrumentToken),
      tradingsymbol,
      exchange,
      user.userId,
      "ai_analysis"
    ).catch(console.error);

    // SAFETY: Validate this is a LIVE mode request
    validateCandleMode("LIVE", "ai_analysis");

    // Use unified candle service with proper lookback
    const { candles, sufficient, message } = await getCandlesForAI(
      parseInt(instrumentToken),
      timeframe,
      200  // Request 200 candles for proper analysis
    );

    const latestTick = await getLatestTick(parseInt(instrumentToken));

    // Handle insufficient data
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
        dataWarning: message,
      });
    }

    // Perform Human-Like AI analysis
    const humanAnalysis = await aiSharedService.analyzeMarketHumanLike({
      symbol: tradingsymbol,
      candles,
    }, timeframe);

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

    let result = {
      trend: "neutral",
      strength: 50,
      support: null as number | null,
      resistance: null as number | null,
      analysis: "Analysis in progress...",
      signal: "hold",
      confidence: 50,
      entry: null as number | null,
      target: null as number | null,
      stopLoss: null as number | null,
      reasoning: "Signal generation in progress...",
    };

    const parsed = parseAIResponse(humanAnalysis);
    
      if (parsed) {
        // Map new Human-Like format to existing AnalysisResult format
        const bias = parsed.bias || "NEUTRAL";
        const confidence = (parsed.confidence || 0.5) * 100;
        const summary = parsed.technical_summary || parsed.reasoning || [];
        
        result = {
          trend: bias.toLowerCase(),
          strength: confidence,
          support: parsed.stoploss_zone?.[0] || null,
          resistance: parsed.target_zone?.[0] || null,
          analysis: summary.join(". "),
          signal: parsed.state === "EXECUTE" ? (bias === "BULLISH" ? "buy" : bias === "BEARISH" ? "sell" : "hold") : "hold",
          confidence: confidence,
          entry: parsed.entry_zone?.[0] || null,
          target: parsed.target_zone?.[0] || null,
          stopLoss: parsed.stoploss_zone?.[0] || null,
        reasoning: summary.join(". "),
      };
    }

    // 3. Log AI usage
    logAIUsage(
      user.userId,
      "analyze",
      humanAnalysis.tokensUsed || 0,
      humanAnalysis.model,
      { instrument: tradingsymbol, timeframe }
    ).catch(console.error);

    return NextResponse.json({

        success: true,
        analysis: result,
        hasData: true,
        dataPoints: candles.length,
        dataSource: "LIVE",
        dataSufficient: sufficient,
        dataWarning: message,
        latestPrice: latestTick?.lastPrice || candles[candles.length - 1]?.close,
        aiProvider: humanAnalysis.provider || "fallback",
        cached: humanAnalysis.cached,
      });
  } catch (error) {
    console.error("AI Analysis error:", error);
    
    // Check for safety violation
    if (error instanceof Error && error.message.includes("SAFETY VIOLATION")) {
      return badRequestResponse(error.message);
    }
    
    return serverErrorResponse();
  }
}
