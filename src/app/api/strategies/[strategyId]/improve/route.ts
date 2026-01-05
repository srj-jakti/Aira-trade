import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { strategyService } from "@/lib/server/strategy-service";
import { aiTradingEngine } from "@/lib/server/ai-trading-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId: id } = await params;
    const body = await request.json();
    const { strategy, backtestResults, candleData } = body;

    if (!strategy || !backtestResults) {
      return badRequestResponse("Missing required fields: strategy, backtestResults");
    }

    // Get AI Trading Engine suggestions based on historical performance
    const strategyIdNum = parseInt(id);
    const aiEngineSuggestions = await aiTradingEngine.suggestStrategyImprovements(strategyIdNum);

    const improvement = await strategyService.improveStrategyWithAI(
      strategy,
      backtestResults,
      candleData,
      strategyIdNum,
      aiEngineSuggestions
    );

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
