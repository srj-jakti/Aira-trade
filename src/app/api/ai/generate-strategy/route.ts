import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { aiSharedService } from "@/lib/server/ai-shared-service";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const { userInput, referenceInstrument } = body as {
      userInput?: string;
      referenceInstrument?: string;
    };

    const response = await aiSharedService.generateStrategyIdea(
      userInput,
      referenceInstrument
    );

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
      cached: response.cached,
    });
  } catch (error) {
    console.error("AI Strategy Generation error:", error);
    return serverErrorResponse();
  }
}
