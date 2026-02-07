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
      const { 
        rawInput, 
        aiAnalysisEnabled = false, 
        mode = "traditional", 
        currentStrategy = null,
        selectedInstruments = [],
        timeframe = "15m"
      } = body;

      if (!rawInput || typeof rawInput !== "string" || rawInput.trim().length < 2) {
        return badRequestResponse("Please provide a valid strategy description");
      }

      const formattedStrategy = await strategyService.formatStrategyWithAI(
        rawInput, 
        aiAnalysisEnabled, 
        mode as "traditional" | "neural",
        currentStrategy
      );
      
      formattedStrategy.ai_analysis_enabled = aiAnalysisEnabled;

      let instrumentScores = null;
      let recommendedInstruments = null;

      if (selectedInstruments.length > 0) {
        try {
          const { rlKnowledgeEngine } = await import("@/lib/server/rl-knowledge-engine");
          
          const tokens = selectedInstruments.map((i: { instrument_token: number }) => i.instrument_token);
          
          instrumentScores = await rlKnowledgeEngine.scoreTradeSelection(
            tokens,
            rawInput,
            timeframe,
            { trend: "SIDEWAYS", volatility: "NORMAL", volume: "AVERAGE" }
          );

          const selection = await rlKnowledgeEngine.selectBestInstrumentsForStrategy(
            tokens,
            rawInput,
            timeframe,
            5
          );
          
          recommendedInstruments = {
            tokens: selection.selected,
            reasoning: selection.reasoning
          };
        } catch (error) {
          console.error("RL scoring failed during format:", error);
        }
      }

      return successResponse({ 
        strategy: formattedStrategy,
        instrumentScores,
        recommendedInstruments 
      });
    } catch (error) {
    console.error("Error formatting strategy:", error);
    return serverErrorResponse("Failed to format strategy with AI");
  }
}
