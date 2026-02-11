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

    // ITERATIVE IMPROVEMENT: Run multiple iterations until profitable
    console.log("[Improve] Starting iterative improvement with auto-backtest validation");
    
    const maxIterations = 5;
    let bestStrategy = strategy;
    let bestResults = backtestResults;
    let iterationHistory = [];
    let totalTokensUsed = 0;
    
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      console.log(`[Improve] Iteration ${iteration}/${maxIterations}`);
      
      // Build iteration context
      const iterationContext = iteration > 1 
        ? `ITERATION ${iteration}/${maxIterations}:\nPrevious attempt had ${bestResults.total_trades} trades, ${bestResults.win_rate.toFixed(1)}% win rate, ${bestResults.net_pnl_percentage.toFixed(2)}% P&L.\n${iteration > 2 ? `History: ${iterationHistory.map((h: any) => `v${h.iteration}: ${h.trades} trades, ${h.winRate}% WR, ${h.pnl}% P&L`).join('; ')}` : ''}`
        : undefined;
      
      // Run AI improvement
      const improvement = await strategyService.improveStrategyWithAI(
        bestStrategy,
        bestResults,
        candleData,
        strategyIdNum,
        aiEngineSuggestions,
        "ITERATIVE",
        iterationContext
      );
      
      totalTokensUsed += improvement.tokensUsed || 0;
      
      // Validate: Check if improved strategy has valid logic
      const improvedStrategy = improvement.improved;
      if (!improvedStrategy.executable_strategy || 
          !improvedStrategy.executable_strategy.buy?.rules?.length ||
          !improvedStrategy.executable_strategy.sell?.rules?.length) {
        console.log(`[Improve] Iteration ${iteration} produced invalid strategy, keeping previous version`);
        break;
      }
      
      // Auto-backtest the improved strategy (if we have the data)
      let newResults = null;
      if (instrumentTokens && timeframe && candleData) {
        try {
          console.log(`[Improve] Auto-backtesting iteration ${iteration}`);
          newResults = await strategyService.backtestStrategy(
            improvedStrategy,
            instrumentTokens,
            timeframe,
            capital || 100000
          );
          
          console.log(`[Improve] Iteration ${iteration} results:`, {
            trades: newResults.total_trades,
            winRate: newResults.win_rate,
            pnl: newResults.net_pnl_percentage
          });
          
          // Track history
          iterationHistory.push({
            iteration,
            trades: newResults.total_trades,
            winRate: newResults.win_rate.toFixed(1),
            pnl: newResults.net_pnl_percentage.toFixed(2)
          });
          
          // CRITICAL: Reject if zero trades or worse performance
          if (newResults.total_trades === 0) {
            console.log(`[Improve] Iteration ${iteration} produced ZERO trades - REJECTED`);
            continue; // Try next iteration
          }
          
          // Calculate profit factor for comparison
          const oldProfitFactor = bestResults.total_trades > 0 
            ? (bestResults.net_pnl / Math.abs(bestResults.net_pnl - bestResults.gross_profit)) 
            : 0;
          const newProfitFactor = newResults.total_trades > 0 
            ? (newResults.net_pnl / Math.abs(newResults.net_pnl - newResults.gross_profit)) 
            : 0;
          
          // Accept if better profit factor AND maintains reasonable trade count
          const isImprovement = newProfitFactor > oldProfitFactor && newResults.total_trades >= (bestResults.total_trades * 0.5);
          
          if (isImprovement) {
            console.log(`[Improve] Iteration ${iteration} ACCEPTED - Better performance`);
            bestStrategy = improvedStrategy;
            bestResults = newResults;
            
            // If highly profitable, stop early
            if (newResults.win_rate > 60 && newResults.net_pnl_percentage > 10) {
              console.log(`[Improve] Highly profitable strategy found, stopping early`);
              break;
            }
          } else {
            console.log(`[Improve] Iteration ${iteration} REJECTED - No improvement`);
          }
        } catch (backtestError) {
          console.error(`[Improve] Backtest failed for iteration ${iteration}:`, backtestError);
          // Continue with next iteration
        }
      } else {
        // No auto-backtest available, accept the improvement
        console.log(`[Improve] No backtest data available, accepting iteration ${iteration}`);
        bestStrategy = improvedStrategy;
        break;
      }
    }
    
    console.log("[Improve] Iterative improvement completed:", {
      iterations: iterationHistory.length,
      finalTrades: bestResults.total_trades,
      finalWinRate: bestResults.win_rate,
      finalPnL: bestResults.net_pnl_percentage,
      totalTokensUsed
    });

    // 3. Log AI usage
    logAIUsage(
      user.userId,
      "improve",
      totalTokensUsed,
      "iterative-improvement",
      { strategyId: strategyIdNum, mode, iterations: iterationHistory.length }
    ).catch(console.error);

    return successResponse({
      improved: bestStrategy,
      notes: `Iterative improvement completed after ${iterationHistory.length} iterations. Final: ${bestResults.total_trades} trades, ${bestResults.win_rate.toFixed(1)}% win rate, ${bestResults.net_pnl_percentage.toFixed(2)}% P&L.`,
      tokensUsed: totalTokensUsed,
      model: "iterative-improvement",
      iterationHistory,
      finalBacktestResults: bestResults,
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
