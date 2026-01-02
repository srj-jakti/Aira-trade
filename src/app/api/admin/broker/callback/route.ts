import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/server/encryption";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");
  const adminConfigId = url.searchParams.get("admin_config_id");

  if (status === "error" || !requestToken) {
    console.error("[Admin Callback] OAuth failed - status:", status);
    return renderResult(false, "Authentication failed. Please try again.");
  }

  if (!adminConfigId) {
    console.error("[Admin Callback] No admin_config_id provided");
    return renderResult(false, "Missing configuration ID.");
  }

  try {
    const { data: config } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("id", adminConfigId)
      .single();

    if (!config) {
      console.error("[Admin Callback] No config found for id:", adminConfigId);
      return renderResult(false, "Configuration not found.");
    }

    const apiKey = decrypt(config.api_key);
    const apiSecret = decrypt(config.api_secret);

    const checksum = crypto
      .createHash("sha256")
      .update(apiKey + requestToken + apiSecret)
      .digest("hex");

    console.log("[Admin Callback] Exchanging token for config:", config.name);

    const tokenResp = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Kite-Version": "3",
      },
      body: new URLSearchParams({
        api_key: apiKey,
        request_token: requestToken,
        checksum: checksum,
      }).toString(),
    });

    const tokenData = await tokenResp.json();

    if (tokenData.status !== "success" || !tokenData.data?.access_token) {
      console.error("[Admin Callback] Token exchange failed:", tokenData.message);
      return renderResult(false, tokenData.message || "Token exchange failed.");
    }

    const accessToken = tokenData.data.access_token;
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(23, 59, 59, 999);

    await supabaseAdmin
      .from("admin_zerodha_configs")
      .update({
        access_token: encrypt(accessToken),
        connection_status: "connected",
        is_authorized: true,
        last_login_at: now.toISOString(),
        token_expires_at: expiresAt.toISOString(),
        last_error: null,
        updated_at: now.toISOString(),
      })
      .eq("id", config.id);

    await supabaseAdmin.from("zerodha_login_logs").insert({
      config_id: config.id,
      login_type: "manual",
      status: "success",
      triggered_by: "admin_manual",
    });

    console.log("[Admin Callback] Successfully authorized config:", config.name);

    return renderResult(true, "Zerodha authorized successfully!");
  } catch (error) {
    console.error("[Admin Callback] Error:", error);
    return renderResult(false, "Server error. Please try again.");
  }
}

function renderResult(success: boolean, message: string) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${success ? "Zerodha Authorized" : "Authorization Failed"}</title>
  <style>
    body { 
      font-family: system-ui, sans-serif; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh; 
      margin: 0; 
      background: #030303; 
      color: white;
    }
    .container { text-align: center; padding: 2rem; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    h1 { margin: 0 0 0.5rem; }
    p { color: #888; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon ${success ? "success" : "error"}">${success ? "✓" : "✕"}</div>
    <h1>${success ? "Authorized!" : "Failed"}</h1>
    <p>${message}</p>
    <p style="margin-top: 1rem; font-size: 0.875rem;">This window will close automatically...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'ZERODHA_ADMIN_AUTH_SUCCESS', success: ${success} }, '*');
    }
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
