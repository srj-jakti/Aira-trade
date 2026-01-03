import { NextRequest } from "next/server";
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
  badRequestResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/admin/market-data/subscriptions
 * 
 * Returns all active instrument subscriptions joined with instrument metadata.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse();

  try {
    const { data: subscriptions, error } = await supabaseAdmin
      .from("instrument_subscriptions")
      .select("*")
      .order("priority", { ascending: true });

    if (error) {
      console.error("[AdminSubscriptions] Error fetching subscriptions:", JSON.stringify(error, null, 2));
      return serverErrorResponse();
    }

    // Fetch instrument details for subscriptions
    let subscriptionsWithInstruments: any[] = [];
    if (subscriptions && subscriptions.length > 0) {
      const tokens = subscriptions.map(s => s.instrument_token);
      const { data: instruments } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, tradingsymbol, name, exchange, segment, instrument_type")
        .in("instrument_token", tokens);

      const instrumentMap = new Map(instruments?.map(i => [i.instrument_token, i]) || []);
      subscriptionsWithInstruments = subscriptions.map(sub => ({
        ...sub,
        instruments: instrumentMap.get(sub.instrument_token) || null
      }));
    }

    // Also fetch pending requests
    const { data: requests, error: reqError } = await supabaseAdmin
      .from("subscription_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (reqError) {
      console.error("[AdminSubscriptions] Error fetching requests:", JSON.stringify(reqError, null, 2));
    }

    // Fetch instrument details for pending requests
    let requestsWithInstruments: any[] = [];
    if (requests && requests.length > 0) {
      const tokens = requests.map(r => r.instrument_token);
      const { data: instruments } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, tradingsymbol, name, exchange")
        .in("instrument_token", tokens);

      const instrumentMap = new Map(instruments?.map(i => [i.instrument_token, i]) || []);
      requestsWithInstruments = requests.map(req => ({
        ...req,
        instruments: instrumentMap.get(req.instrument_token) || null
      }));
    }

    return successResponse({
      subscriptions: subscriptionsWithInstruments,
      pendingRequests: requestsWithInstruments,
    });
  } catch (error) {
    console.error("[AdminSubscriptions] Unexpected error:", error);
    return serverErrorResponse();
  }
}

/**
 * PATCH /api/admin/market-data/subscriptions
 * 
 * Updates a subscription's priority/tier.
 */
export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse();

  try {
    const body = await request.json();
    const { instrumentToken, priority } = body;

    if (!instrumentToken || !priority) {
      return badRequestResponse("instrumentToken and priority are required");
    }

    const { error } = await supabaseAdmin
      .from("instrument_subscriptions")
      .update({ priority })
      .eq("instrument_token", instrumentToken);

    if (error) {
      console.error("[AdminSubscriptions] Error updating priority:", error);
      return serverErrorResponse();
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error("[AdminSubscriptions] Unexpected error:", error);
    return serverErrorResponse();
  }
}

/**
 * DELETE /api/admin/market-data/subscriptions
 * 
 * Removes an active subscription.
 */
export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse();

  try {
    const searchParams = request.nextUrl.searchParams;
    const instrumentToken = searchParams.get("instrumentToken");

    if (!instrumentToken) {
      return badRequestResponse("instrumentToken is required");
    }

    const { error } = await supabaseAdmin
      .from("instrument_subscriptions")
      .delete()
      .eq("instrument_token", parseInt(instrumentToken));

    if (error) {
      console.error("[AdminSubscriptions] Error deleting subscription:", error);
      return serverErrorResponse();
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error("[AdminSubscriptions] Unexpected error:", error);
    return serverErrorResponse();
  }
}
