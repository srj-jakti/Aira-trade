import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { uuidSchema } from "@/lib/validations";
import { logAudit } from "@/lib/server/audit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  if (!admin.isAdmin) {
    return forbiddenResponse("Admin access required");
  }

  const { userId } = await params;
  const validation = uuidSchema.safeParse(userId);
  if (!validation.success) {
    return badRequestResponse("Invalid user ID");
  }

  if (userId === admin.userId) {
    return badRequestResponse("Cannot delete your own account");
  }

  try {
    const tables = [
      "strategies",
      "trading_preferences",
      "user_config",
      "subscriptions",
      "trade_history",
      "user_broker_accounts",
      "user_orders",
      "user_positions",
      "profiles",
    ];

    for (const table of tables) {
      const column = table === "profiles" ? "id" : "user_id";
      await supabaseAdmin.from(table).delete().eq(column, userId);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
    }

    await logAudit({
      user_id: admin.userId!,
      action: "admin_user_deleted",
      target_table: "auth.users",
      target_id: userId,
    });

    return successResponse({ success: true });
  } catch (err) {
    console.error("Error deleting user:", err);
    return serverErrorResponse();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  if (!admin.isAdmin) {
    return forbiddenResponse("Admin access required");
  }

  const { userId } = await params;
  const validation = uuidSchema.safeParse(userId);
  if (!validation.success) {
    return badRequestResponse("Invalid user ID");
  }

  if (userId === admin.userId) {
    return badRequestResponse("Cannot modify your own account");
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "block") {
      const banDuration = "876000h";
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: banDuration,
      });
      if (error) {
        console.error("Error blocking user:", error);
        return serverErrorResponse();
      }

      await logAudit({
        user_id: admin.userId!,
        action: "admin_user_blocked",
        target_table: "auth.users",
        target_id: userId,
      });

      return successResponse({ success: true, message: "User blocked" });
    }

    if (action === "unblock") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });
      if (error) {
        console.error("Error unblocking user:", error);
        return serverErrorResponse();
      }

      await logAudit({
        user_id: admin.userId!,
        action: "admin_user_unblocked",
        target_table: "auth.users",
        target_id: userId,
      });

      return successResponse({ success: true, message: "User unblocked" });
    }

    if (action === "approve") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          is_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: admin.userId,
        }, { onConflict: "id" });

      if (error) {
        console.error("Error approving user:", error);
        return serverErrorResponse();
      }

      await logAudit({
        user_id: admin.userId!,
        action: "admin_user_approved",
        target_table: "profiles",
        target_id: userId,
      });

      return successResponse({ success: true, message: "User approved" });
    }

    if (action === "revoke") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          is_approved: false,
          approved_at: null,
          approved_by: null,
        }, { onConflict: "id" });

      if (error) {
        console.error("Error revoking approval:", error);
        return serverErrorResponse();
      }

      await logAudit({
        user_id: admin.userId!,
        action: "admin_user_revoked",
        target_table: "profiles",
        target_id: userId,
      });

      return successResponse({ success: true, message: "Access revoked" });
    }

    return badRequestResponse("Invalid action");
  } catch (err) {
    console.error("Error updating user:", err);
    return serverErrorResponse();
  }
}
