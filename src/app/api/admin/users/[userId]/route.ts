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

const VALID_PLANS = ["basic", "pro", "elite", "admin"];
const VALID_DURATIONS = ["1_month", "3_months", "6_months", "1_year", "lifetime"];

function getDurationEndDate(duration: string): Date | null {
  const now = new Date();
  switch (duration) {
    case "1_month":
      return new Date(now.setMonth(now.getMonth() + 1));
    case "3_months":
      return new Date(now.setMonth(now.getMonth() + 3));
    case "6_months":
      return new Date(now.setMonth(now.getMonth() + 6));
    case "1_year":
      return new Date(now.setFullYear(now.getFullYear() + 1));
    case "lifetime":
      return null;
    default:
      return new Date(now.setMonth(now.getMonth() + 1));
  }
}

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
    const { action, plan, duration, reason } = body;

    if (action === "assign_plan") {
      if (!plan || !VALID_PLANS.includes(plan)) {
        return badRequestResponse("Invalid plan");
      }
      if (!duration || !VALID_DURATIONS.includes(duration)) {
        return badRequestResponse("Invalid duration");
      }

      const endDate = getDurationEndDate(duration);
      const now = new Date().toISOString();

      await supabaseAdmin
        .from("subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("is_admin_grant", true);

      const { error } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          user_id: userId,
          plan_id: plan,
          plan_name: plan.toUpperCase(),
          status: "active",
          current_period_start: now,
          current_period_end: endDate?.toISOString() || null,
          is_admin_grant: true,
          granted_by: admin.userId,
          grant_reason: reason || `Admin granted ${plan} plan`,
          created_at: now,
          updated_at: now,
        });

      if (error) {
        console.error("Error assigning plan:", error);
        return serverErrorResponse();
      }

      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          is_approved: true,
          approved_at: now,
          approved_by: admin.userId,
        }, { onConflict: "id" });

      await logAudit({
        user_id: admin.userId!,
        action: "admin_plan_assigned",
        target_table: "subscriptions",
        target_id: userId,
        details: { plan, duration, reason },
      });

      return successResponse({ 
        success: true, 
        message: `${plan.toUpperCase()} plan assigned for ${duration.replace("_", " ")}` 
      });
    }

    if (action === "revoke_plan") {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("is_admin_grant", true);

      if (error) {
        console.error("Error revoking plan:", error);
        return serverErrorResponse();
      }

      await logAudit({
        user_id: admin.userId!,
        action: "admin_plan_revoked",
        target_table: "subscriptions",
        target_id: userId,
      });

      return successResponse({ success: true, message: "Plan revoked" });
    }

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
