import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { aiSharedService } from "@/lib/server/ai-shared-service";

/**
 * POST /api/ai/generate-strategy
 * 
 * Generates a profitable intraday strategy using AI.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const response = await aiSharedService.generateStrategyIdea();

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || "Failed to generate strategy" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      strategy: response.result,
      provider: response.provider,
    });
  } catch (error) {
    console.error("AI Strategy Generation error:", error);
    return serverErrorResponse();
  }
}
