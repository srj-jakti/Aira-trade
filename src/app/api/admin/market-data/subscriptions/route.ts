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
      .select(`
        instrument_token,
        priority,
        api_key_id,
        instruments:instruments!inner(
          tradingsymbol,
          name,
          exchange,
          segment,
          instrument_type
        )
      `)
      .order("priority", { ascending: true });

    if (error) {
      console.error("[AdminSubscriptions] Error fetching subscriptions:", error);
      return serverErrorResponse();
    }

    // Also fetch pending requests
    const { data: requests } = await supabaseAdmin
      .from("subscription_requests")
      .select(`
        id,
        instrument_token,
        tier,
        status,
        created_at,
        instruments:instruments!inner(
          tradingsymbol,
          name,
          exchange
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    return successResponse({
      subscriptions: subscriptions || [],
      pendingRequests: requests || [],
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
