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

        if (mode === "deep" && instrumentTokens && timeframe) {
          const improvement = await strategyService.findHighestWinningRateVariation(
            strategy,
            instrumentTokens,
            timeframe,
            capital || 100000,
            undefined,
            undefined,
            strategyIdNum
          );
          return successResponse(improvement);
        }


      // Get AI Trading Engine suggestions based on historical performance
      const aiEngineSuggestions = await aiTradingEngine.suggestStrategyImprovements(strategyIdNum);

      const improvement = await strategyService.improveStrategyWithAI(
        strategy,
        backtestResults,
        candleData,
        strategyIdNum,
        aiEngineSuggestions
      );

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
        aiEngineSuggestions
      });
    } catch (error) {

    console.error("Error improving strategy:", error);
    const message = error instanceof Error ? error.message : "AI improvement failed";
    return serverErrorResponse(message);
  }
}
