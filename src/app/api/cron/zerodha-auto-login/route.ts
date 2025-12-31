import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/server/encryption";
import { performZerodhaFullLogin } from "@/lib/server/zerodha-auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function loginConfig(config: {
  id: string;
  name: string;
  api_key: string;
  api_secret: string;
  user_id: string;
  password: string;
  totp_secret: string;
}, triggerType: string) {
  try {
    await supabaseAdmin
      .from("admin_zerodha_configs")
      .update({ connection_status: "connecting" })
      .eq("id", config.id);

    const result = await performZerodhaFullLogin({
      api_key: decrypt(config.api_key),
      api_secret: decrypt(config.api_secret),
      user_id: decrypt(config.user_id),
      password: decrypt(config.password),
      totp_secret: decrypt(config.totp_secret),
    });

    if (result.success && result.accessToken) {
      const tokenExpiry = new Date();
      tokenExpiry.setHours(23, 59, 59, 999);

      await supabaseAdmin
        .from("admin_zerodha_configs")
        .update({
          access_token: encrypt(result.accessToken),
          token_expires_at: tokenExpiry.toISOString(),
          last_login_at: new Date().toISOString(),
          connection_status: "connected",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      await supabaseAdmin.from("zerodha_login_logs").insert({
        config_id: config.id,
        login_type: "scheduled",
        status: "success",
        triggered_by: triggerType,
      });

      return { id: config.id, name: config.name, success: true };
    } else {
      await supabaseAdmin
        .from("admin_zerodha_configs")
        .update({
          connection_status: "error",
          last_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      await supabaseAdmin.from("zerodha_login_logs").insert({
        config_id: config.id,
        login_type: "scheduled",
        status: "failed",
        error_message: result.error,
        triggered_by: triggerType,
      });

      return { id: config.id, name: config.name, success: false, error: result.error };
    }
  } catch (error) {
    console.error(`Error logging in config ${config.id}:`, error);
    return { 
      id: config.id, 
      name: config.name, 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.log("[Auto-Login Cron] Unauthorized request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { triggerType = "scheduled", configId } = body;

    console.log("[Auto-Login Cron] Starting auto-login, trigger:", triggerType, "configId:", configId || "all");

    let configs;
    
    if (configId) {
      const { data } = await supabaseAdmin
        .from("admin_zerodha_configs")
        .select("*")
        .eq("id", configId)
        .single();
      configs = data ? [data] : [];
    } else {
      const { data, error: fetchError } = await supabaseAdmin
        .from("admin_zerodha_configs")
        .select("*")
        .eq("is_active", true)
        .eq("auto_login_enabled", true);

      if (fetchError) {
        console.error("[Auto-Login Cron] Error fetching configs:", fetchError);
        return serverErrorResponse();
      }
      configs = data || [];
    }

    console.log(`[Auto-Login Cron] Found ${configs.length} configs to process`);

    const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];

    for (const config of configs) {
      console.log(`[Auto-Login Cron] Processing config: ${config.name} (${config.id})`);
      const result = await loginConfig(config, triggerType);
      results.push(result);
      console.log(`[Auto-Login Cron] Result for ${config.name}: ${result.success ? "SUCCESS" : "FAILED - " + result.error}`);
    }

    await supabaseAdmin.from("system_health_logs").insert({
      metric_type: "zerodha_auto_login",
      metric_value: { results, totalConfigs: configs.length },
      severity: results.every((r) => r.success) ? "info" : "warning",
      message: `Auto-login completed for ${results.filter((r) => r.success).length}/${results.length} configs`,
    });

    return successResponse({ 
      success: true, 
      results,
      message: `Processed ${results.length} configurations`
    });
  } catch (error) {
    console.error("[Auto-Login Cron] Error:", error);
    return serverErrorResponse();
  }
}

export async function GET() {
  return successResponse({ 
    status: "ok", 
    description: "Zerodha auto-login cron endpoint. Runs daily at 3:30 AM IST.",
    usage: "POST with Bearer token authorization"
  });
}
