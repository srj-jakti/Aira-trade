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
    await params;
    const body = await request.json();
    const { strategy, backtestResults } = body;

    if (!strategy || !backtestResults) {
      return badRequestResponse("Missing required fields: strategy, backtestResults");
    }

    const improvement = await strategyService.improveStrategyWithAI(
      strategy,
      backtestResults
    );

    return successResponse(improvement);
  } catch (error) {
    console.error("Error improving strategy:", error);
    const message = error instanceof Error ? error.message : "AI improvement failed";
    return serverErrorResponse(message);
  }
}
