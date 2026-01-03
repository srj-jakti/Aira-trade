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

const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_TEMP_PER_USER = 50;
const GLOBAL_TEMP_CAP = 1000;

const userRequestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userRate = userRequestCounts.get(userId);

  if (!userRate || now > userRate.resetAt) {
    userRequestCounts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (userRate.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }

  userRate.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - userRate.count };
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) {
    return unauthorizedResponse();
  }

  const rateCheck = checkRateLimit(user.user.id);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Rate limit exceeded. Please wait before making more requests.",
        retryAfter: 60
      }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const body = await request.json();
    const { instrumentToken, instrumentTokens, source = "user_request" } = body;

    const tokens: number[] = instrumentTokens 
      ? (Array.isArray(instrumentTokens) ? instrumentTokens : [instrumentTokens])
      : (instrumentToken ? [instrumentToken] : []);

    if (tokens.length === 0) {
      return badRequestResponse("Valid instrumentToken or instrumentTokens array is required");
    }

    if (tokens.length > 100) {
      return badRequestResponse("Maximum 100 instruments per request");
    }

    const results: { token: number; status: string }[] = [];

    for (const token of tokens) {
      if (typeof token !== "number") continue;

      const { data: existing } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, is_subscribed")
        .eq("instrument_token", token)
        .single();

      if (existing?.is_subscribed) {
        results.push({ token, status: "already_subscribed" });
        continue;
      }

      if (existing) {
        await supabaseAdmin
          .from("instruments")
          .update({ is_subscribed: true, subscription_mode: "quote" })
          .eq("instrument_token", token);
        results.push({ token, status: "subscribed" });
      } else {
        results.push({ token, status: "not_found" });
      }
    }

    return successResponse({ 
      success: true, 
      results,
      remaining: rateCheck.remaining,
    });

  } catch (error) {
    console.error("Error processing subscription request:", error);
    return serverErrorResponse();
  }
}

export async function POST_LEGACY(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) {
    return unauthorizedResponse();
  }

  const rateCheck = checkRateLimit(user.userId!);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Rate limit exceeded. Please wait before making more requests.",
        retryAfter: 60
      }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const body = await request.json();
    const { instrumentToken, source = "user_request" } = body;

    if (!instrumentToken || typeof instrumentToken !== "number") {
      return badRequestResponse("Valid instrumentToken is required");
    }

    const tier: SubscriptionTier = source === "chart" || source === "ai_analysis" 
      ? "TEMP" 
      : source === "scanner" || source === "watchlist"
        ? "POPULAR"
        : "TEMP";

    const { data: existing } = await supabaseAdmin
      .from("instrument_subscriptions")
      .select("instrument_token, priority")
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
        existingTier: existing.priority,
        instrumentToken,
        remaining: rateCheck.remaining,
      });
    }

    if (tier === "TEMP") {
      const { count: userTempCount } = await supabaseAdmin
        .from("subscription_requests")
        .select("*", { count: "exact", head: true })
        .eq("source", `user_${user.user.id}`)
        .eq("tier", "TEMP")
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());

      if (userTempCount && userTempCount >= MAX_TEMP_PER_USER) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "User TEMP subscription limit reached. Please wait for existing subscriptions to expire.",
            limit: MAX_TEMP_PER_USER
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      const { count: globalTempCount } = await supabaseAdmin
        .from("instrument_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("priority", "TEMP");

      if (globalTempCount && globalTempCount >= GLOBAL_TEMP_CAP) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "System at capacity. Please try again later.",
            status: "capacity_exceeded"
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const { data: pendingRequest } = await supabaseAdmin
      .from("subscription_requests")
      .select("id")
      .eq("instrument_token", instrumentToken)
      .eq("status", "pending")
      .single();

    if (pendingRequest) {
      return successResponse({ 
        subscribed: true, 
        status: "already_requested",
        instrumentToken,
        remaining: rateCheck.remaining,
      });
    }

    const { error } = await supabaseAdmin
      .from("subscription_requests")
      .insert({
        instrument_token: instrumentToken,
        tier,
        source: `${source}_user_${user.user.id}`,
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
      instrumentToken,
      remaining: rateCheck.remaining,
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
