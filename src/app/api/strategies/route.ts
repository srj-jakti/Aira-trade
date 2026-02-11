import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { strategyService } from "@/lib/server/strategy-service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription/plans";
import { getUserPlan } from "@/lib/server/admin-check";

export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
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
      return badRequestResponse("Missing required fields: strategy, rawInput, selectedTimeframes, visibility");
    }

    if (!["private", "public", "invite_only"].includes(visibility)) {
      return badRequestResponse("Invalid visibility option. Must be: private, public, or invite_only");
    }

    // Validate strategy structure
    if (!strategy.name || !strategy.description) {
      return badRequestResponse("Strategy must have name and description");
    }

    // Get user's effective plan (considers admin status)
    const planId = await getUserPlan(user.userId!);
    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS] || SUBSCRIPTION_PLANS.basic;
    
    if (visibility === "invite_only" && !plan.features.inviteOnlyStrategies) {
      return badRequestResponse("Invite-only strategies require ELITE plan or higher");
    }

    console.log("[Strategy Save] Saving strategy:", {
      userId: user.userId,
      name: strategy.name,
      visibility,
      timeframes: selectedTimeframes,
      instruments: selectedInstruments?.length || 0
    });

    const strategyId = await strategyService.saveStrategy(
      user.userId!,
      strategy,
      rawInput,
      selectedTimeframes,
      visibility,
      isPaperTrading || false,
      selectedInstruments || []
    );

    console.log("[Strategy Save] Strategy saved successfully:", strategyId);

    return successResponse({ 
      id: strategyId, 
      message: `Strategy saved successfully as ${visibility}`,
      visibility,
      can_activate: true
    }, 201);
  } catch (error) {
    console.error("Error saving strategy:", error);
    const message = error instanceof Error ? error.message : "Failed to save strategy";
    return serverErrorResponse(message);
  }
}
