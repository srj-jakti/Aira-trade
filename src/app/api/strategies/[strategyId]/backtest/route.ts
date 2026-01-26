import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { strategyService } from "@/lib/server/strategy-service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aiTradingEngine } from "@/lib/server/ai-trading-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId } = await params;
    const body = await request.json();
    const { 
      strategy, 
      instrumentToken,
      instrumentTokens,
      timeframe, 
      capital,
      fromDate,
      toDate,
      zerodhaConfigId,
      zairothIntent
    } = body;

    if (!strategy || !timeframe) {
      return badRequestResponse("Missing required fields: strategy, timeframe");
    }

    let tokens: number[] = [];
    if (instrumentTokens && Array.isArray(instrumentTokens)) {
      tokens = instrumentTokens.map((t: number | string) => typeof t === "string" ? parseInt(t) : t);
    } else if (instrumentToken) {
      tokens = [typeof instrumentToken === "string" ? parseInt(instrumentToken) : instrumentToken];
    }

    if (tokens.length === 0) {
      return badRequestResponse("At least one instrument is required");
    }

    if (tokens.length > 2) {
      return badRequestResponse("Maximum 2 instruments allowed per backtest");
    }

    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    await supabaseAdmin.from("brain_events").insert({
      event_type: "BACKTEST_START",
      details: {
        strategyId,
        instrumentTokens: tokens,
        timeframe,
        capital: capital || 100000,
        userId: user.user.id,
        hasZairothIntent: !!zairothIntent,
      },
      created_at: new Date().toISOString(),
    });

    const result = await strategyService.runBacktest(
      strategy,
      tokens,
      timeframe,
      capital || 100000,
      from,
      to,
      zerodhaConfigId
    );

    const { data: instrumentsData } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, tradingsymbol")
      .in("instrument_token", tokens);
    
    const instrumentMap = new Map(
      (instrumentsData || []).map(i => [i.instrument_token, i.tradingsymbol])
    );

        if (strategyId !== "preview") {
          const id = parseInt(strategyId);
          await strategyService.saveBacktestResult(
            id,
            1,
            tokens,
            timeframe,
            result,
            strategy
          );

          if (result.trades && result.trades.length > 0) {
            const trades = result.trades.map((t: { pnl: number; entry_price: number; exit_price: number; entry_time: string; exit_time: string }) => ({
              pnl: t.pnl,
              entryPrice: t.entry_price,
              exitPrice: t.exit_price,
              duration: `${Math.round((new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / 60000)}m`
            }));
            
            await aiTradingEngine.updateStrategyPerformance(
              id,
              user.user.id,
              "backtest",
              trades
            );

            const { selfLearningEngine } = await import("@/lib/server/self-learning-engine");
            await selfLearningEngine.observeBacktestResult({
              strategyId: id.toString(),
              userId: user.user.id,
              zairothIntent: strategy.zairoth_intent,
              result: {
                netPnl: result.net_pnl,
                winRate: result.win_rate,
                totalTrades: result.total_trades,
                maxDrawdown: result.max_drawdown,
              }
            });

            const { rlKnowledgeEngine } = await import("@/lib/server/rl-knowledge-engine");
            const patternType = extractPatternType(strategy);
            
            for (const token of tokens) {
              const tradingSymbol = instrumentMap.get(token) || `TOKEN_${token}`;
              const tokenTrades = result.trades;
              const tokenProfitable = tokenTrades.filter((t: { pnl: number }) => t.pnl > 0).length;
              const tokenWinRate = tokenTrades.length > 0 ? (tokenProfitable / tokenTrades.length) * 100 : 0;
              const tokenAvgPnl = tokenTrades.length > 0 
                ? tokenTrades.reduce((sum: number, t: { pnl: number }) => sum + t.pnl, 0) / tokenTrades.length 
                : 0;
              
              await rlKnowledgeEngine.updateInstrumentKnowledge(
                token,
                tradingSymbol,
                patternType,
                timeframe,
                {
                  pnl: tokenAvgPnl,
                  isProfit: result.net_pnl > 0,
                  riskReward: result.profit_factor || 1,
                  entryConditions: {
                    indicators: strategy.entry?.indicators || [],
                    conditions: strategy.entry?.conditions || [],
                  },
                  marketCondition: result.win_rate > 50 ? "trending" : "ranging",
                }
              );
            }

            if (result.win_rate < 45 || result.net_pnl < 0) {
              await selfLearningEngine.autoImproveStrategy(id.toString(), user.user.id);
            }
          }
        }


      await supabaseAdmin.from("brain_events").insert({
        event_type: "BACKTEST_COMPLETE",
        details: {
          strategyId,
          totalTrades: result.total_trades,
          netPnl: result.net_pnl,
          winRate: result.win_rate,
          userId: user.user.id,
        },
        created_at: new Date().toISOString(),
      });

      let aiInsights = null;
      let rlInsights = null;
      
      if (strategyId !== "preview") {
        const id = parseInt(strategyId);
        const improvements = await aiTradingEngine.suggestStrategyImprovements(id);
        aiInsights = improvements;
        
        try {
          const { rlKnowledgeEngine } = await import("@/lib/server/rl-knowledge-engine");
          rlInsights = await rlKnowledgeEngine.getGlobalRLInsights();
        } catch (e) {
          console.error("Failed to get RL insights:", e);
        }
      }

      return successResponse({ result, aiInsights, rlInsights });
  } catch (error) {
    console.error("Error running backtest:", error);
    const message = error instanceof Error ? error.message : "Backtest failed";
    return serverErrorResponse(message);
  }
}

function extractPatternType(strategy: Record<string, unknown>): string {
  const strategyStr = JSON.stringify(strategy).toLowerCase();
  
  if (strategyStr.includes("rsi") && strategyStr.includes("oversold")) return "rsi_oversold";
  if (strategyStr.includes("rsi") && strategyStr.includes("overbought")) return "rsi_overbought";
  if (strategyStr.includes("macd") && strategyStr.includes("cross")) return "macd_crossover";
  if (strategyStr.includes("ema") && strategyStr.includes("cross")) return "ema_crossover";
  if (strategyStr.includes("breakout")) return "breakout";
  if (strategyStr.includes("reversal")) return "reversal";
  if (strategyStr.includes("momentum")) return "momentum";
  if (strategyStr.includes("support") || strategyStr.includes("resistance")) return "sr_bounce";
  
  return "generic";
}
