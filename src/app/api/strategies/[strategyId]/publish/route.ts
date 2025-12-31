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
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);
    const body = await request.json();
    const { visibility } = body;

    if (!["private", "public", "invite_only"].includes(visibility)) {
      return badRequestResponse("Invalid visibility option");
    }

    const { data: strategy } = await supabaseAdmin
      .from("strategies")
      .select("user_id, is_finalized")
      .eq("id", id)
      .single();

    if (!strategy) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    if (strategy.user_id !== user.userId) {
      return forbiddenResponse();
    }

    if (!strategy.is_finalized) {
      return badRequestResponse("Cannot publish unfinalized strategy");
    }

    const updateData: Record<string, unknown> = {
      visibility,
      updated_at: new Date().toISOString(),
    };

    if (visibility === "private") {
      updateData.admin_approved = false;
      updateData.admin_approved_at = null;
      updateData.admin_approved_by = null;
    }

    await supabaseAdmin.from("strategies").update(updateData).eq("id", id);

    return successResponse({
      message:
        visibility === "private"
          ? "Strategy set to private"
          : "Strategy submitted for approval",
      visibility,
      requiresApproval: visibility !== "private",
    });
  } catch (error) {
    console.error("Error publishing strategy:", error);
    return serverErrorResponse();
  }
}
