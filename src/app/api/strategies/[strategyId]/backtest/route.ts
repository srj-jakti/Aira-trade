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

    return successResponse({ result });
  } catch (error) {
    console.error("Error running backtest:", error);
    const message = error instanceof Error ? error.message : "Backtest failed";
    return serverErrorResponse(message);
  }
}
