import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { strategyService } from "@/lib/server/strategy-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId } = await params;
    const body = await request.json();
    const { strategy, instrumentToken, timeframe, capital } = body;

    if (!strategy || !instrumentToken || !timeframe) {
      return badRequestResponse("Missing required fields: strategy, instrumentToken, timeframe");
    }

    const result = await strategyService.runBacktest(
      strategy,
      instrumentToken,
      timeframe,
      capital || 100000
    );

    if (strategyId !== "preview") {
      const id = parseInt(strategyId);
      await strategyService.saveBacktestResult(
        id,
        1,
        instrumentToken,
        timeframe,
        result,
        strategy
      );
    }

    return successResponse({ result });
  } catch (error) {
    console.error("Error running backtest:", error);
    const message = error instanceof Error ? error.message : "Backtest failed";
    return serverErrorResponse(message);
  }
}
