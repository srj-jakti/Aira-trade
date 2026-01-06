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
      const { rawInput, aiAnalysisEnabled = false } = body;

      if (!rawInput || typeof rawInput !== "string" || rawInput.trim().length < 5) {
        return badRequestResponse("Please provide a valid strategy description");
      }

      const formattedStrategy = await strategyService.formatStrategyWithAI(rawInput, aiAnalysisEnabled);
      
      // Pass the flag back to the UI so it can be saved
      formattedStrategy.ai_analysis_enabled = aiAnalysisEnabled;

      return successResponse({ strategy: formattedStrategy });
    } catch (error) {
    console.error("Error formatting strategy:", error);
    return serverErrorResponse("Failed to format strategy with AI");
  }
}
