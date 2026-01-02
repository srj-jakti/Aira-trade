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
import { encrypt, decrypt, maskCredential } from "@/lib/server/encryption";
import { logAudit } from "@/lib/server/audit";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const { data: configs, error } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .order("priority", { ascending: true });

    if (error) {
      console.error("Error fetching zerodha configs:", error);
      return serverErrorResponse();
    }

    const maskedConfigs = (configs || []).map((config) => ({
      ...config,
      api_key: decrypt(config.api_key),
      api_secret: maskCredential(decrypt(config.api_secret)),
      user_id: decrypt(config.user_id),
      password: "********",
      totp_secret: "********",
      access_token: config.access_token ? maskCredential(decrypt(config.access_token)) : null,
    }));

    return successResponse({ configs: maskedConfigs });
  } catch (error) {
    console.error("Error in zerodha configs GET:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const body = await request.json();
    const { name, apiKey, apiSecret, userId, password, totpSecret, autoLoginTime, autoLoginEnabled, priority } = body;

    if (!name || !apiKey || !apiSecret || !userId || !password || !totpSecret) {
      return badRequestResponse("All fields are required");
    }

    const { data, error } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .insert({
        name,
        api_key: encrypt(apiKey),
        api_secret: encrypt(apiSecret),
        user_id: encrypt(userId),
        password: encrypt(password),
        totp_secret: encrypt(totpSecret),
        auto_login_time: autoLoginTime || "08:30:00",
        auto_login_enabled: autoLoginEnabled !== false,
        priority: priority || 1,
        connection_status: "disconnected",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating zerodha config:", error);
      return serverErrorResponse();
    }

    await logAudit({
      user_id: admin.userId!,
      action: "zerodha_config_created",
      target_table: "admin_zerodha_configs",
      target_id: data.id,
      metadata: { name },
    });

    return successResponse({ 
      config: {
        ...data,
        api_key: maskCredential(apiKey),
        api_secret: maskCredential(apiSecret),
        password: "********",
        totp_secret: "********",
      }
    });
  } catch (error) {
    console.error("Error in zerodha configs POST:", error);
    return serverErrorResponse();
  }
}
