import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { z } from "zod";
import { logAudit } from "@/lib/server/audit";

const toggleSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["trading", "scanner"]).optional().default("trading"),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validation = toggleSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse("Invalid toggle value");
    }

    const { enabled, type } = validation.data;
    
    const updateData: Record<string, unknown> = {
      user_id: auth.userId,
      updated_at: new Date().toISOString(),
    };
    
    if (type === "scanner") {
      updateData.is_scanner_active = enabled;
    } else {
      updateData.auto_trading_enabled = enabled;
    }

    const { error } = await supabaseAdmin.from("trading_preferences").upsert(
      updateData,
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      return serverErrorResponse();
    }

    await logAudit({
      user_id: auth.userId!,
      action: type === "scanner" 
        ? (enabled ? "scanner_enabled" : "scanner_disabled")
        : (enabled ? "trading_enabled" : "trading_disabled"),
      target_table: "trading_preferences",
    });

    return successResponse({
      success: true,
      [type === "scanner" ? "is_scanner_active" : "auto_trading_enabled"]: enabled,
    });
  } catch {
    return serverErrorResponse();
  }
}
