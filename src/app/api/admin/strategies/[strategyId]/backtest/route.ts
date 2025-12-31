import { NextRequest } from "next/server";
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { strategyService } from "@/lib/server/strategy-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);
    const body = await request.json();
    const { timeframe, instrumentToken } = body;

    if (!timeframe) {
      return badRequestResponse("Timeframe is required");
    }

    const { data: strategy, error } = await supabaseAdmin
      .from("strategies")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !strategy) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    const structuredStrategy = {
      name: strategy.name,
      description: strategy.description,
      buy_entry_logic: strategy.buy_entry_logic || {},
      buy_stop_loss: strategy.buy_stop_loss || {},
      buy_target: strategy.buy_target || {},
      buy_trailing_sl: strategy.buy_trailing_sl || {},
      sell_entry_logic: strategy.sell_entry_logic || {},
      sell_stop_loss: strategy.sell_stop_loss || {},
      sell_target: strategy.sell_target || {},
      sell_trailing_sl: strategy.sell_trailing_sl || {},
      hold_logic: strategy.hold_logic || {},
    };

    let testInstrumentToken = instrumentToken;
    if (!testInstrumentToken) {
      const { data: instruments } = await supabaseAdmin
        .from("historical_candles")
        .select("instrument_token")
        .eq("timeframe", timeframe)
        .limit(1);
      
      if (instruments && instruments.length > 0) {
        testInstrumentToken = instruments[0].instrument_token;
      } else {
        return badRequestResponse("No historical data available for this timeframe");
      }
    }

    const result = await strategyService.runBacktest(
      structuredStrategy,
      testInstrumentToken,
      timeframe,
      100000
    );

    await supabaseAdmin.from("strategy_backtests").insert({
      strategy_id: id,
      strategy_version: strategy.version || 1,
      instrument_token: testInstrumentToken,
      timeframe,
      capital_used: result.capital_used,
      total_trades: result.total_trades,
      buy_count: result.buy_count,
      sell_count: result.sell_count,
      hold_count: result.hold_count,
      net_pnl: result.net_pnl,
      net_pnl_percentage: result.net_pnl_percentage,
      win_rate: result.win_rate,
      loss_rate: result.loss_rate,
      max_drawdown: result.max_drawdown,
      max_drawdown_percentage: result.max_drawdown_percentage,
      trade_log: result.trade_log,
      strategy_snapshot: structuredStrategy,
    });

    return successResponse({
      result: {
        timeframe,
        capital_used: result.capital_used,
        total_trades: result.total_trades,
        net_pnl: result.net_pnl,
        net_pnl_percentage: result.net_pnl_percentage,
        win_rate: result.win_rate,
        max_drawdown_percentage: result.max_drawdown_percentage,
      },
    });
  } catch (error) {
    console.error("Error running admin backtest:", error);
    const message = error instanceof Error ? error.message : "Backtest failed";
    return serverErrorResponse(message);
  }
}
