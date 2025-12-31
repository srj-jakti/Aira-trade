import { NextRequest } from "next/server";
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { userApprovalSchema } from "@/lib/validations";
import { logAudit } from "@/lib/server/audit";

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  if (!admin.isAdmin) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const body = await request.json();
    const validation = userApprovalSchema.safeParse({
      userId: body.userId,
      approved: body.approve,
    });

    if (!validation.success) {
      return badRequestResponse("Invalid request", validation.error.flatten());
    }

    const { userId, approved } = validation.data;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_approved: approved,
        approved_at: approved ? new Date().toISOString() : null,
        approved_by: approved ? admin.userId : null,
      })
      .eq("id", userId);

    if (error) {
      return serverErrorResponse();
    }

    await logAudit({
      user_id: admin.userId!,
      action: approved ? "admin_user_approved" : "admin_user_rejected",
      target_table: "profiles",
      target_id: userId,
    });

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}
