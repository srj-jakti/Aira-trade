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

    const { error } = await supabaseAdmin.from("trading_preferences").upsert(
      {
        user_id: auth.userId,
        auto_trading_enabled: validation.data.enabled,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      return serverErrorResponse();
    }

    await logAudit({
      user_id: auth.userId!,
      action: validation.data.enabled ? "trading_enabled" : "trading_disabled",
      target_table: "trading_preferences",
    });

    return successResponse({
      success: true,
      auto_trading_enabled: validation.data.enabled,
    });
  } catch {
    return serverErrorResponse();
  }
}
