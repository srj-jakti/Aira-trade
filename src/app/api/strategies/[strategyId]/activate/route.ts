import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);
    const body = await request.json();
    const { active } = body;

    const { data: strategy } = await supabaseAdmin
      .from("strategies")
      .select("user_id, is_finalized")
      .eq("id", id)
      .single();

    if (!strategy) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    if (strategy.user_id !== user.userId) {
      const hasAccess = await checkUserAccess(id, user.userId!);
      if (!hasAccess) return forbiddenResponse();
    }

    if (!strategy.is_finalized) {
      return Response.json(
        { error: "Cannot activate unfinalized strategy" },
        { status: 400 }
      );
    }

    await supabaseAdmin
      .from("strategies")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", id);

    return successResponse({
      message: active ? "Strategy activated" : "Strategy deactivated",
      is_active: active,
    });
  } catch (error) {
    console.error("Error toggling strategy activation:", error);
    return serverErrorResponse();
  }
}

async function checkUserAccess(strategyId: number, userId: string): Promise<boolean> {
  const { data: grant } = await supabaseAdmin
    .from("strategy_access_grants")
    .select("id, expires_at, is_revoked")
    .eq("strategy_id", strategyId)
    .eq("user_id", userId)
    .single();

  if (grant && !grant.is_revoked) {
    if (!grant.expires_at || new Date(grant.expires_at) > new Date()) {
      return true;
    }
  }

  return false;
}
