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
      return badRequestResponse("Invalid visibility option. Must be: private, public, or invite_only");
    }

    const { data: strategy, error: fetchError } = await supabaseAdmin
      .from("strategies")
      .select("user_id, is_finalized, visibility")
      .eq("id", id)
      .single();

    if (fetchError || !strategy) {
      console.error("Strategy fetch error:", fetchError);
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    if (strategy.user_id !== user.userId) {
      return forbiddenResponse();
    }

    const currentVisibility = strategy.visibility;

    // Auto-finalize if not already finalized
    if (!strategy.is_finalized) {
      console.log(`[Publish] Auto-finalizing strategy ${id} before publishing`);
      await supabaseAdmin
        .from("strategies")
        .update({
          is_finalized: true,
          status: "finalized",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    const updateData: Record<string, unknown> = {
      visibility,
      updated_at: new Date().toISOString(),
    };

    // Reset approval when changing visibility
    if (visibility === "private") {
      updateData.admin_approved = false;
      updateData.admin_approved_at = null;
      updateData.admin_approved_by = null;
    } else if (visibility === "public" || visibility === "invite_only") {
      // Public and invite_only require admin approval
      updateData.admin_approved = false;
      updateData.admin_approved_at = null;
      updateData.admin_approved_by = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from("strategies")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Strategy update error:", updateError);
      return serverErrorResponse("Failed to update strategy visibility: " + updateError.message);
    }

    console.log(`[Publish] Strategy ${id} visibility changed: ${currentVisibility} → ${visibility}`);

    return successResponse({
      message:
        visibility === "private"
          ? "Strategy set to private"
          : visibility === "invite_only"
          ? "Strategy set to invite-only (requires admin approval)"
          : "Strategy submitted for public approval",
      visibility,
      requiresApproval: visibility !== "private",
      status: visibility === "private" ? "active" : "pending_approval"
    });
  } catch (error) {
    console.error("Error publishing strategy:", error);
    const message = error instanceof Error ? error.message : "Failed to publish strategy";
    return serverErrorResponse(message);
  }
}
