import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { strategyService } from "@/lib/server/strategy-service";
import { aiTradingEngine } from "@/lib/server/ai-trading-engine";
import { checkAILimit, logAIUsage } from "@/lib/server/ai-usage";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    // 1. Get user's plan for limit checking
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

    const { strategyId: id } = await params;
    const body = await request.json();
    const { strategy, backtestResults, candleData, mode = "simple", instrumentTokens, timeframe, capital } = body;

    if (!strategy || !backtestResults) {
      return badRequestResponse("Missing required fields: strategy, backtestResults");
    }

    const strategyIdNum = parseInt(id);

    console.log("[Improve] Starting strategy improvement:", {
      strategyId: strategyIdNum,
      mode,
      userId: user.userId,
      winRate: backtestResults.win_rate,
      totalTrades: backtestResults.total_trades
    });

    // Deep mode with RL optimization
    if (mode === "deep" && instrumentTokens && timeframe) {
      console.log("[Improve] Running deep mode with RL optimization");
      try {
        const improvement = await strategyService.findHighestWinningRateVariation(
          strategy,
          instrumentTokens,
          timeframe,
          capital || 100000,
          undefined,
          undefined,
          strategyIdNum
        );
        
        // Log AI usage (deep mode doesn't track tokens)
        logAIUsage(
          user.userId,
          "improve",
          0,
          "rl-engine",
          { strategyId: strategyIdNum, mode: "deep" }
        ).catch(console.error);

        return successResponse(improvement);
      } catch (deepError) {
        console.error("[Improve] Deep mode failed:", deepError);
        // Fall through to simple mode
      }
    }

    // Get AI Trading Engine suggestions (with fallback)
    let aiEngineSuggestions;
    try {
      console.log("[Improve] Fetching AI Trading Engine suggestions");
      aiEngineSuggestions = await aiTradingEngine.suggestStrategyImprovements(strategyIdNum);
      console.log("[Improve] AI Engine suggestions:", aiEngineSuggestions);
    } catch (aiError) {
      console.error("[Improve] AI Engine suggestions failed:", aiError);
      aiEngineSuggestions = {
        suggestions: ["AI Engine unavailable - using fallback optimization"],
        expectedImprovement: 0
      };
    }

    // Run AI improvement with fallback handling
    console.log("[Improve] Running AI improvement");
    const improvement = await strategyService.improveStrategyWithAI(
      strategy,
      backtestResults,
      candleData,
      strategyIdNum,
      aiEngineSuggestions
    );

    console.log("[Improve] Improvement completed:", {
      tokensUsed: improvement.tokensUsed,
      model: improvement.model,
      hasImprovedStrategy: !!improvement.improved
    });

    // 3. Log AI usage
    logAIUsage(
      user.userId,
      "improve",
      improvement.tokensUsed || 0,
      improvement.model,
      { strategyId: strategyIdNum, mode }
    ).catch(console.error);

    return successResponse({
      ...improvement,
      aiEngineSuggestions,
      rlEngineConnected: !!process.env.RL_ENGINE_URL,
      mode
    });
  } catch (error) {
    console.error("Error improving strategy:", error);
    const message = error instanceof Error ? error.message : "AI improvement failed";
    
    // Return detailed error for debugging
    return NextResponse.json({
      success: false,
      error: message,
      details: error instanceof Error ? error.stack : undefined,
      rlEngineUrl: process.env.RL_ENGINE_URL || "not_configured",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
