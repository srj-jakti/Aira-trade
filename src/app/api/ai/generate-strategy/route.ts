import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { aiSharedService } from "@/lib/server/ai-shared-service";
import { checkAILimit, logAIUsage } from "@/lib/server/ai-usage";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    // 1. Get user's plan for limit checking
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", user.userId)
      .single();
    
    const planId = sub?.plan_id || "basic";

    // 2. Check limits
    const limitCheck = await checkAILimit(user.userId, planId);
    if (!limitCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: limitCheck.reason,
        usage: limitCheck.usage
      }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { userInput, referenceInstrument, mode } = body as {
      userInput?: string;
      referenceInstrument?: string;
      mode?: "traditional" | "neural";
    };

    const response = mode === "neural" 
      ? await aiSharedService.generateNeuralStrategyIdea(userInput, referenceInstrument)
      : await aiSharedService.generateStrategyIdea(userInput, referenceInstrument);

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || "Failed to generate strategy" },
        { status: 500 }
      );
    }

    // 3. Log AI usage
    logAIUsage(
      user.userId,
      "generate",
      response.tokensUsed || 0,
      response.model,
      { mode, instrument: referenceInstrument }
    ).catch(console.error);

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
