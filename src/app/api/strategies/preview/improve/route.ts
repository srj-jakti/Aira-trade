import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { strategyService } from "@/lib/server/strategy-service";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

    try {
      const body = await request.json();
      const { strategy, backtestResults, candleData, mode = "simple", instrumentTokens, timeframe, capital } = body;

      if (!strategy || !backtestResults) {
        return badRequestResponse("Missing required fields: strategy, backtestResults");
      }

      if (mode === "deep" && instrumentTokens && timeframe) {
        const improvement = await strategyService.findHighestWinningRateVariation(
          strategy,
          instrumentTokens,
          timeframe,
          capital || 100000
        );
        return successResponse(improvement);
      }

      const improvement = await strategyService.improveStrategyWithAI(
        strategy,
        backtestResults,
        candleData
      );

      return successResponse(improvement);
    } catch (error) {

    console.error("Error improving strategy:", error);
    const message = error instanceof Error ? error.message : "AI improvement failed";
    return serverErrorResponse(message);
  }
}
