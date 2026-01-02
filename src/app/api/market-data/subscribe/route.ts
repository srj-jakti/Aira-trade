import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  successResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SubscriptionTier = "CORE" | "POPULAR" | "TEMP";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { instrumentToken, source = "user_request" } = body;

    if (!instrumentToken) {
      return badRequestResponse("instrumentToken is required");
    }

    const tier: SubscriptionTier = source === "chart" || source === "ai_analysis" 
      ? "TEMP" 
      : source === "scanner" || source === "watchlist"
        ? "POPULAR"
        : "TEMP";

    const { data: existing } = await supabaseAdmin
      .from("instrument_subscriptions")
      .select("instrument_token")
      .eq("instrument_token", instrumentToken)
      .single();

    if (existing) {
      await supabaseAdmin
        .from("instrument_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("instrument_token", instrumentToken);

      return successResponse({ 
        subscribed: true, 
        status: "already_subscribed",
        instrumentToken 
      });
    }

    const { error } = await supabaseAdmin
      .from("subscription_requests")
      .insert({
        instrument_token: instrumentToken,
        tier,
        source,
        status: "pending",
      });

    if (error) {
      console.error("Error creating subscription request:", error);
      return serverErrorResponse();
    }

    return successResponse({ 
      subscribed: true, 
      status: "requested",
      tier,
      instrumentToken 
    });

  } catch (error) {
    console.error("Error processing subscription request:", error);
    return serverErrorResponse();
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) {
    return unauthorizedResponse();
  }

  const searchParams = request.nextUrl.searchParams;
  const instrumentToken = searchParams.get("instrumentToken");

  if (!instrumentToken) {
    return badRequestResponse("instrumentToken is required");
  }

  try {
    const { data } = await supabaseAdmin
      .from("instrument_subscriptions")
      .select("instrument_token, priority, last_used_at")
      .eq("instrument_token", parseInt(instrumentToken))
      .single();

    return successResponse({
      isSubscribed: !!data,
      subscription: data,
    });

  } catch (error) {
    console.error("Error checking subscription:", error);
    return serverErrorResponse();
  }
}
