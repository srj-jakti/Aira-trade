import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { tradingSettingsSchema } from "@/lib/validations";
import { logAudit } from "@/lib/server/audit";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("trading_preferences")
      .select("*")
      .eq("user_id", auth.userId)
      .single();

    if (error && error.code !== "PGRST116") {
      return serverErrorResponse();
    }

    return successResponse({ settings: data || {} });
  } catch {
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validation = tradingSettingsSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse("Invalid settings", validation.error.flatten());
    }

    const { data: existing } = await supabaseAdmin
      .from("trading_preferences")
      .select("auto_trading_enabled")
      .eq("user_id", auth.userId)
      .single();

    const { error } = await supabaseAdmin.from("trading_preferences").upsert(
      {
        user_id: auth.userId,
        ...validation.data,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      return serverErrorResponse();
    }

    if (
      validation.data.auto_trading_enabled !== undefined &&
      existing?.auto_trading_enabled !== validation.data.auto_trading_enabled
    ) {
      await logAudit({
        user_id: auth.userId!,
        action: validation.data.auto_trading_enabled ? "trading_enabled" : "trading_disabled",
        target_table: "trading_preferences",
      });
    } else {
      await logAudit({
        user_id: auth.userId!,
        action: "risk_settings_updated",
        target_table: "trading_preferences",
        metadata: { fields_updated: Object.keys(validation.data) },
      });
    }

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}
