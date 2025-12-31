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
      .from("admin_ai_configs")
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
      },
    });
  } catch (error) {
    console.error("Error fetching AI config:", error);
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
    const { provider, model, apiKey, isDefault, isActive, priority } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (provider !== undefined) updateData.provider = provider;
    if (model !== undefined) updateData.model = model;
    if (apiKey) updateData.api_key = encrypt(apiKey);
    if (isActive !== undefined) updateData.is_active = isActive;
    if (priority !== undefined) updateData.priority = priority;

    if (isDefault === true) {
      await supabaseAdmin
        .from("admin_ai_configs")
        .update({ is_default: false })
        .eq("is_default", true);
      updateData.is_default = true;
    } else if (isDefault === false) {
      updateData.is_default = false;
    }

    const { data, error } = await supabaseAdmin
      .from("admin_ai_configs")
      .update(updateData)
      .eq("id", configId)
      .select()
      .single();

    if (error) {
      console.error("Error updating AI config:", error);
      return serverErrorResponse();
    }

    await logAudit({
      user_id: admin.userId!,
      action: "ai_config_updated",
      target_table: "admin_ai_configs",
      target_id: configId,
      metadata: { fields: Object.keys(updateData) },
    });

    return successResponse({
      config: {
        ...data,
        api_key: maskCredential(decrypt(data.api_key)),
      },
    });
  } catch (error) {
    console.error("Error in AI config PUT:", error);
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
      .from("admin_ai_configs")
      .delete()
      .eq("id", configId);

    if (error) {
      console.error("Error deleting AI config:", error);
      return serverErrorResponse();
    }

    await logAudit({
      user_id: admin.userId!,
      action: "ai_config_deleted",
      target_table: "admin_ai_configs",
      target_id: configId,
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error in AI config DELETE:", error);
    return serverErrorResponse();
  }
}
