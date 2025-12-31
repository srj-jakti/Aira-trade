import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/server/encryption";
import crypto from "crypto";

function generateTOTP(secret: string): string {
  const time = Math.floor(Date.now() / 1000 / 30);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(time));
  
  const secretBuffer = Buffer.from(secret.replace(/\s/g, "").toUpperCase(), "base32");
  const hmac = crypto.createHmac("sha1", secretBuffer);
  hmac.update(timeBuffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

async function performZerodhaLogin(config: {
  id: string;
  api_key: string;
  api_secret: string;
  user_id: string;
  password: string;
  totp_secret: string;
}): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const apiKey = decrypt(config.api_key);
    const apiSecret = decrypt(config.api_secret);
    const userId = decrypt(config.user_id);
    const password = decrypt(config.password);
    const totpSecret = decrypt(config.totp_secret);

    const loginResponse = await fetch("https://kite.zerodha.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ user_id: userId, password }),
    });

    const loginData = await loginResponse.json();
    if (!loginData.data?.request_id) {
      return { success: false, error: loginData.message || "Login failed - no request_id" };
    }

    const totpCode = generateTOTP(totpSecret);
    const twofaResponse = await fetch("https://kite.zerodha.com/api/twofa", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        user_id: userId,
        request_id: loginData.data.request_id,
        twofa_value: totpCode,
        twofa_type: "totp",
      }),
    });

    const twofaData = await twofaResponse.json();
    if (!twofaData.data?.request_token) {
      const redirectUrl = twofaResponse.headers.get("location");
      let requestToken = null;
      
      if (redirectUrl) {
        const urlParams = new URLSearchParams(redirectUrl.split("?")[1]);
        requestToken = urlParams.get("request_token");
      }
      
      if (!requestToken) {
        return { success: false, error: twofaData.message || "2FA failed - no request_token" };
      }
      twofaData.data = { request_token: requestToken };
    }

    const checksum = crypto
      .createHash("sha256")
      .update(apiKey + twofaData.data.request_token + apiSecret)
      .digest("hex");

    const sessionResponse = await fetch(
      `https://api.kite.trade/session/token`,
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Kite-Version": "3",
        },
        body: new URLSearchParams({
          api_key: apiKey,
          request_token: twofaData.data.request_token,
          checksum,
        }),
      }
    );

    const sessionData = await sessionResponse.json();
    if (!sessionData.data?.access_token) {
      return { success: false, error: sessionData.message || "Session generation failed" };
    }

    return { success: true, accessToken: sessionData.data.access_token };
  } catch (error) {
    console.error("Zerodha login error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.log("Unauthorized cron request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { triggerType = "scheduled" } = body;

    const { data: configs, error: fetchError } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("is_active", true)
      .eq("auto_login_enabled", true);

    if (fetchError) {
      console.error("Error fetching configs:", fetchError);
      return serverErrorResponse();
    }

    const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];

    for (const config of configs || []) {
      await supabaseAdmin
        .from("admin_zerodha_configs")
        .update({ connection_status: "connecting" })
        .eq("id", config.id);

      const result = await performZerodhaLogin(config);

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

        results.push({ id: config.id, name: config.name, success: true });
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

        results.push({ id: config.id, name: config.name, success: false, error: result.error });
      }
    }

    await supabaseAdmin.from("system_health_logs").insert({
      metric_type: "zerodha_auto_login",
      metric_value: { results, totalConfigs: configs?.length || 0 },
      severity: results.every((r) => r.success) ? "info" : "warning",
      message: `Auto-login completed for ${results.filter((r) => r.success).length}/${results.length} configs`,
    });

    return successResponse({ 
      success: true, 
      results,
      message: `Processed ${results.length} configurations`
    });
  } catch (error) {
    console.error("Error in auto-login cron:", error);
    return serverErrorResponse();
  }
}

export async function GET() {
  return successResponse({ 
    status: "ok", 
    description: "Zerodha auto-login cron endpoint",
    usage: "POST with Bearer token authorization"
  });
}
