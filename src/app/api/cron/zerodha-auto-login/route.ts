import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/server/encryption";
import { performZerodhaFullLogin } from "@/lib/server/zerodha-auth";
import { zerodhaService } from "@/lib/server/zerodha-service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function loginAdminConfig(config: {
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

async function loginUserAccount(account: {
  id: string;
  user_id: string;
  api_key: string;
  api_secret: string;
  user_id_broker: string;
  password?: string;
  totp_secret?: string;
}) {
  try {
    if (!account.api_key || !account.api_secret || !account.user_id_broker || !account.password || !account.totp_secret) {
      return { id: account.id, success: false, error: "Missing credentials" };
    }

    const result = await performZerodhaFullLogin({
      api_key: decrypt(account.api_key),
      api_secret: decrypt(account.api_secret),
      user_id: decrypt(account.user_id_broker),
      password: decrypt(account.password),
      totp_secret: decrypt(account.totp_secret),
    });

    if (result.success && result.accessToken) {
      const tokenExpiry = new Date();
      tokenExpiry.setHours(23, 59, 59, 999);

      await supabaseAdmin
        .from("user_broker_accounts")
        .update({
          access_token: encrypt(result.accessToken),
          token_expires_at: tokenExpiry.toISOString(),
          last_connected_at: new Date().toISOString(),
          is_connected: true,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      return { id: account.id, user_id: account.user_id, success: true };
    } else {
      await supabaseAdmin
        .from("user_broker_accounts")
        .update({
          is_connected: false,
          last_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      return { id: account.id, user_id: account.user_id, success: false, error: result.error };
    }
  } catch (error) {
    console.error(`Error logging in user account ${account.id}:`, error);
    return { 
      id: account.id, 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const isAuthorized = authHeader && (
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (serviceKey && authHeader === `Bearer ${serviceKey}`)
  );
  
  if (!isAuthorized) {
    console.log("[Auto-Login Cron] Unauthorized POST request");
    return Response.json({ 
      error: "Unauthorized",
      details: "Missing or invalid authorization header"
    }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { triggerType = "scheduled" } = body;

    console.log("[Auto-Login Cron] Starting auto-login, trigger:", triggerType);

    // 1. Process Admin Configs (Master)
    const { data: adminConfigs } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("is_active", true)
      .eq("auto_login_enabled", true);

    const adminResults = [];
    for (const config of adminConfigs || []) {
      const result = await loginAdminConfig(config, triggerType);
      adminResults.push(result);
    }

    // 2. Process User Accounts
    const { data: userAccounts } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("*")
      .eq("is_active", true)
      .not("totp_secret", "is", null);

    const userResults = [];
    for (const account of userAccounts || []) {
      const result = await loginUserAccount(account);
      userResults.push(result);
    }

    const totalProcessed = adminResults.length + userResults.length;
    const totalSuccess = adminResults.filter(r => r.success).length + userResults.filter(r => r.success).length;

    await supabaseAdmin.from("system_health_logs").insert({
      metric_type: "zerodha_auto_login",
      metric_value: { adminResults, userResults, totalSuccess, totalProcessed },
      severity: totalSuccess === totalProcessed ? "info" : "warning",
      message: `Auto-login completed for ${totalSuccess}/${totalProcessed} accounts`,
    });

    return successResponse({ 
      success: true, 
      adminResults,
      userResults,
      message: `Processed ${totalProcessed} accounts`
    });
  } catch (error) {
    console.error("[Auto-Login Cron] Error:", error);
    return serverErrorResponse();
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  
  // Authorization logic for GET (Vercel Crons)
  // 1. If CRON_SECRET is set, prioritize it
  // 2. If it's a Vercel Cron and no CRON_SECRET is set, allow it (Vercel verifies this header internally)
  // 3. Fallback to SUPABASE_SERVICE_ROLE_KEY
  const isAuthorized = 
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (isVercelCron && !cronSecret) ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  
  if (!isAuthorized) {
    console.log("[Auto-Login Cron] Unauthorized GET request. Vercel-Cron:", isVercelCron);
    return Response.json({ 
      error: "Unauthorized",
      details: "Invalid authorization for cron job. Ensure CRON_SECRET is set in environment variables."
    }, { status: 401 });
  }

  try {
    const result = await runAutoLogin(isVercelCron ? "vercel_cron" : "manual_get");

    return successResponse({ 
      success: true, 
      ...result,
      message: `Processed ${result.totalProcessed} accounts`
    });
  } catch (error) {
    console.error("[Auto-Login Cron] Error:", error);
    return serverErrorResponse();
  }
}
