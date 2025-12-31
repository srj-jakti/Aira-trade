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

  try {
    const tables = [
      "strategies",
      "trading_preferences",
      "user_config",
      "subscriptions",
      "trade_history",
      "profiles",
    ];

    for (const table of tables) {
      const column = table === "profiles" ? "id" : "user_id";
      await supabaseAdmin.from(table).delete().eq(column, userId);
    }

    await logAudit({
      user_id: admin.userId!,
      action: "admin_user_deleted",
      target_table: "profiles",
      target_id: userId,
    });

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}
