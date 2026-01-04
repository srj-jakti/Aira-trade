import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { strategyService } from "@/lib/server/strategy-service";

import { strategyExecutionEngine } from "@/lib/server/strategy-execution-engine";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    // Ensure execution engine is running
    strategyExecutionEngine.start();
    
    const strategies = await strategyService.getUserStrategies(user.userId!);
    return successResponse({ strategies });
  } catch (error) {
    console.error("Error fetching strategies:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { 
      strategy, 
      rawInput, 
      selectedTimeframes, 
      visibility,
      isPaperTrading,
      selectedInstruments
    } = body;

    if (!strategy || !rawInput || !selectedTimeframes || !visibility) {
      return badRequestResponse("Missing required fields");
    }

    if (!["private", "public", "invite_only"].includes(visibility)) {
      return badRequestResponse("Invalid visibility option");
    }

    const strategyId = await strategyService.saveStrategy(
      user.userId!,
      strategy,
      rawInput,
      selectedTimeframes,
      visibility,
      isPaperTrading || false,
      selectedInstruments || []
    );

    return successResponse({ id: strategyId, message: "Strategy saved successfully" }, 201);
  } catch (error) {
    console.error("Error saving strategy:", error);
    return serverErrorResponse();
  }
}
