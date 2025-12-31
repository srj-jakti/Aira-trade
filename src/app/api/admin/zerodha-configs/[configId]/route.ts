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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  const { configId } = await params;

  try {
    const { data: config, error } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("id", configId)
      .single();

    if (error || !config) {
      return badRequestResponse("Configuration not found");
    }

    return successResponse({
      config: {
        ...config,
        api_key: maskCredential(decrypt(config.api_key)),
        api_secret: maskCredential(decrypt(config.api_secret)),
        password: "********",
        totp_secret: "********",
        access_token: config.access_token ? maskCredential(decrypt(config.access_token)) : null,
      },
    });
  } catch (error) {
    console.error("Error fetching zerodha config:", error);
    return serverErrorResponse();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  const { configId } = await params;

  try {
    const body = await request.json();
    const { name, apiKey, apiSecret, userId, password, totpSecret, autoLoginTime, autoLoginEnabled, priority, isActive } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (apiKey) updateData.api_key = encrypt(apiKey);
    if (apiSecret) updateData.api_secret = encrypt(apiSecret);
    if (userId) updateData.user_id = encrypt(userId);
    if (password) updateData.password = encrypt(password);
    if (totpSecret) updateData.totp_secret = encrypt(totpSecret);
    if (autoLoginTime !== undefined) updateData.auto_login_time = autoLoginTime;
    if (autoLoginEnabled !== undefined) updateData.auto_login_enabled = autoLoginEnabled;
    if (priority !== undefined) updateData.priority = priority;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data, error } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .update(updateData)
      .eq("id", configId)
      .select()
      .single();

    if (error) {
      console.error("Error updating zerodha config:", error);
      return serverErrorResponse();
    }

    await logAudit({
      user_id: admin.userId!,
      action: "zerodha_config_updated",
      target_table: "admin_zerodha_configs",
      target_id: configId,
      metadata: { fields: Object.keys(updateData) },
    });

    return successResponse({
      config: {
        ...data,
        api_key: maskCredential(decrypt(data.api_key)),
        api_secret: maskCredential(decrypt(data.api_secret)),
        password: "********",
        totp_secret: "********",
      },
    });
  } catch (error) {
    console.error("Error in zerodha config PUT:", error);
    return serverErrorResponse();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  const { configId } = await params;

  try {
    const { error } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .delete()
      .eq("id", configId);

    if (error) {
      console.error("Error deleting zerodha config:", error);
      return serverErrorResponse();
    }

    await logAudit({
      user_id: admin.userId!,
      action: "zerodha_config_deleted",
      target_table: "admin_zerodha_configs",
      target_id: configId,
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error in zerodha config DELETE:", error);
    return serverErrorResponse();
  }
}
