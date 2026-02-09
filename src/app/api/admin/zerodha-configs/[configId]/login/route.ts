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
import { decrypt, encrypt } from "@/lib/server/encryption";
import { logAudit } from "@/lib/server/audit";
import { performZerodhaFullLogin } from "@/lib/server/zerodha-auth";
import { getIstEndOfDayExpiryUtcIso } from "@/lib/server/ist-time";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  const { configId } = await params;
  const body = await request.json().catch(() => ({}));
  const triggeredBy = body.triggeredBy || "manual";

  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("id", configId)
      .single();

    if (fetchError || !config) {
      return badRequestResponse("Configuration not found");
    }

    await supabaseAdmin
      .from("admin_zerodha_configs")
      .update({ connection_status: "connecting" })
      .eq("id", configId);

    const result = await performZerodhaFullLogin({
      api_key: decrypt(config.api_key),
      api_secret: decrypt(config.api_secret),
      user_id: decrypt(config.user_id),
      password: decrypt(config.password),
      totp_secret: decrypt(config.totp_secret),
    });

    if (result.success && result.accessToken) {
      const tokenExpiry = getIstEndOfDayExpiryUtcIso();

      await supabaseAdmin
        .from("admin_zerodha_configs")
        .update({
          access_token: encrypt(result.accessToken),
          token_expires_at: tokenExpiry,
          last_login_at: new Date().toISOString(),
          connection_status: "connected",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", configId);

      await supabaseAdmin.from("zerodha_login_logs").insert({
        config_id: configId,
        login_type: triggeredBy === "scheduled" ? "scheduled" : "manual",
        status: "success",
        triggered_by: triggeredBy,
      });

      await logAudit({
        user_id: admin.userId!,
        action: "zerodha_login_success",
        target_table: "admin_zerodha_configs",
        target_id: configId,
        metadata: { triggered_by: triggeredBy },
      });

      return successResponse({ success: true, status: "connected" });
      } else {
        await supabaseAdmin
          .from("admin_zerodha_configs")
          .update({
            connection_status: "error",
            last_error: result.error,
            updated_at: new Date().toISOString(),
          })
          .eq("id", configId);

        await supabaseAdmin.from("zerodha_login_logs").insert({
          config_id: configId,
          login_type: triggeredBy === "scheduled" ? "scheduled" : "manual",
          status: "failed",
          error_message: result.error,
          triggered_by: triggeredBy,
        });

        return successResponse({ 
          success: false, 
          error: result.error, 
          status: "error",
          requiresManualAuth: result.requiresManualAuth,
          authUrl: result.authUrl,
        });
      }
  } catch (error) {
    console.error("Error in zerodha login:", error);
    return serverErrorResponse();
  }
}
