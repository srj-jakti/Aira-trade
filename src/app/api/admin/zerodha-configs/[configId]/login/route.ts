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
import { authenticator } from "otplib";
import crypto from "crypto";

function generateTOTP(secret: string): string {
  const cleanSecret = secret.replace(/\s/g, "").toUpperCase();
  return authenticator.generate(cleanSecret);
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

      return successResponse({ success: false, error: result.error, status: "error" });
    }
  } catch (error) {
    console.error("Error in zerodha login:", error);
    return serverErrorResponse();
  }
}
