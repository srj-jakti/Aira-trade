import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { requestId } = await params;
    const id = parseInt(requestId);
    const body = await request.json();
    const { action, response, expiresInDays } = body;

    if (!["approve", "reject", "revoke"].includes(action)) {
      return badRequestResponse("Invalid action");
    }

    const { data: accessRequest } = await supabaseAdmin
      .from("strategy_access_requests")
      .select(`
        *,
        strategies:strategy_id (user_id)
      `)
      .eq("id", id)
      .single();

    if (!accessRequest) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    const strategy = accessRequest.strategies as { user_id: string };
    if (strategy.user_id !== user.userId) {
      return forbiddenResponse();
    }

    if (action === "approve") {
      let expiresAt: string | null = null;
      if (expiresInDays && expiresInDays > 0) {
        const expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + expiresInDays);
        expiresAt = expireDate.toISOString();
      }

      await supabaseAdmin.from("strategy_access_grants").upsert(
        {
          strategy_id: accessRequest.strategy_id,
          user_id: accessRequest.requester_id,
          granted_by: user.userId!,
          granted_at: new Date().toISOString(),
          expires_at: expiresAt,
          is_revoked: false,
          revoked_at: null,
        },
        { onConflict: "strategy_id,user_id" }
      );

      await supabaseAdmin
        .from("strategy_access_requests")
        .update({
          status: "approved",
          owner_response: response,
          responded_at: new Date().toISOString(),
          access_expires_at: expiresAt,
        })
        .eq("id", id);

      return successResponse({ message: "Access granted" });
    }

    if (action === "reject") {
      await supabaseAdmin
        .from("strategy_access_requests")
        .update({
          status: "rejected",
          owner_response: response,
          responded_at: new Date().toISOString(),
        })
        .eq("id", id);

      return successResponse({ message: "Request rejected" });
    }

    if (action === "revoke") {
      await supabaseAdmin
        .from("strategy_access_grants")
        .update({
          is_revoked: true,
          revoked_at: new Date().toISOString(),
        })
        .eq("strategy_id", accessRequest.strategy_id)
        .eq("user_id", accessRequest.requester_id);

      await supabaseAdmin
        .from("strategy_access_requests")
        .update({
          status: "revoked",
          owner_response: response,
          responded_at: new Date().toISOString(),
        })
        .eq("id", id);

      return successResponse({ message: "Access revoked" });
    }

    return badRequestResponse("Invalid action");
  } catch (error) {
    console.error("Error processing access request:", error);
    return serverErrorResponse();
  }
}
