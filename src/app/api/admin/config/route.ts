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
import { encrypt } from "@/lib/server/encryption";
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
    const { type, config } = body;

    if (!type || !config) {
      return badRequestResponse("Type and config required");
    }

    if (type === "zerodha") {
      const configKeys = [
        { key: "zerodha_api_key", value: config.apiKey },
        { key: "zerodha_api_secret", value: config.apiSecret },
        { key: "zerodha_user_id", value: config.userId },
        { key: "zerodha_password", value: config.password },
        { key: "zerodha_totp_secret", value: config.totpSecret },
      ];

      for (const { key, value } of configKeys) {
        if (value) {
          const encryptedValue = encrypt(value);
          await supabaseAdmin.from("app_config").upsert(
            {
              key,
              value: encryptedValue,
              encrypted: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
          );
        }
      }
    } else if (type === "ai") {
      if (config.apiKey) {
        const encryptedValue = encrypt(config.apiKey);
        await supabaseAdmin.from("app_config").upsert(
          {
            key: "ai_api_key",
            value: encryptedValue,
            encrypted: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      }
    }

    await logAudit({
      user_id: admin.userId!,
      action: "admin_config_updated",
      target_table: "app_config",
      metadata: { config_type: type },
    });

    return successResponse({ success: true });
  } catch {
    return serverErrorResponse();
  }
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  if (!admin.isAdmin) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const { data: configs, error } = await supabaseAdmin
      .from("app_config")
      .select("key, encrypted, updated_at");

    if (error) {
      return serverErrorResponse();
    }

    return successResponse({ configs: configs || [] });
  } catch {
    return serverErrorResponse();
  }
}
