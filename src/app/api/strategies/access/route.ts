import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { data: ownedStrategies } = await supabaseAdmin
      .from("strategies")
      .select("id")
      .eq("user_id", user.userId!)
      .eq("visibility", "invite_only");

    const ownedIds = (ownedStrategies || []).map((s) => s.id);

    const { data: requests } = await supabaseAdmin
      .from("strategy_access_requests")
      .select(`
        *,
        strategies:strategy_id (name),
        profiles:requester_id (username, email)
      `)
      .in("strategy_id", ownedIds.length > 0 ? ownedIds : [0])
      .order("created_at", { ascending: false });

    const { data: myRequests } = await supabaseAdmin
      .from("strategy_access_requests")
      .select(`
        *,
        strategies:strategy_id (name, user_id)
      `)
      .eq("requester_id", user.userId!)
      .order("created_at", { ascending: false });

    const { data: grants } = await supabaseAdmin
      .from("strategy_access_grants")
      .select(`
        *,
        strategies:strategy_id (name)
      `)
      .eq("user_id", user.userId!)
      .eq("is_revoked", false)
      .order("granted_at", { ascending: false });

    return successResponse({
      incomingRequests: requests || [],
      myRequests: myRequests || [],
      myGrants: grants || [],
    });
  } catch (error) {
    console.error("Error fetching access data:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { strategyId, message } = body;

    if (!strategyId) {
      return badRequestResponse("Strategy ID is required");
    }

    const { data: strategy } = await supabaseAdmin
      .from("strategies")
      .select("id, user_id, visibility, admin_approved")
      .eq("id", strategyId)
      .single();

    if (!strategy) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    if (strategy.visibility !== "invite_only") {
      return badRequestResponse("This strategy does not require access requests");
    }

    if (!strategy.admin_approved) {
      return badRequestResponse("This strategy is not available yet");
    }

    if (strategy.user_id === user.userId) {
      return badRequestResponse("You own this strategy");
    }

    const { data: existingGrant } = await supabaseAdmin
      .from("strategy_access_grants")
      .select("id, is_revoked, expires_at")
      .eq("strategy_id", strategyId)
      .eq("user_id", user.userId!)
      .single();

    if (existingGrant && !existingGrant.is_revoked) {
      if (!existingGrant.expires_at || new Date(existingGrant.expires_at) > new Date()) {
        return badRequestResponse("You already have access to this strategy");
      }
    }

    const { data: existingRequest } = await supabaseAdmin
      .from("strategy_access_requests")
      .select("id, status")
      .eq("strategy_id", strategyId)
      .eq("requester_id", user.userId!)
      .single();

    if (existingRequest && existingRequest.status === "pending") {
      return badRequestResponse("You already have a pending request");
    }

    if (existingRequest) {
      await supabaseAdmin
        .from("strategy_access_requests")
        .update({
          status: "pending",
          message,
          owner_response: null,
          responded_at: null,
          created_at: new Date().toISOString(),
        })
        .eq("id", existingRequest.id);
    } else {
      await supabaseAdmin.from("strategy_access_requests").insert({
        strategy_id: strategyId,
        requester_id: user.userId!,
        message,
        status: "pending",
      });
    }

    return successResponse({ message: "Access request submitted" }, 201);
  } catch (error) {
    console.error("Error creating access request:", error);
    return serverErrorResponse();
  }
}
