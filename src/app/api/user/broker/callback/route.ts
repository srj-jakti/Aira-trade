import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/server/encryption";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");
  const adminConfigId = url.searchParams.get("admin_config_id");
  const userIdParam = url.searchParams.get("user_id");

  console.log("[Broker Callback] Received params:", {
    status,
    requestToken: requestToken?.substring(0, 10) + "...",
    adminConfigId,
    userIdParam
  });

  if (status === "error" || !requestToken) {
    console.error("[Broker Callback] OAuth failed - status:", status);
    return renderResult(false, "Authentication failed. Please try again.", adminConfigId ? "admin" : "user");
  }

  if (adminConfigId) {
    return handleAdminCallback(adminConfigId, requestToken);
  }

  let userId: string | null = userIdParam;

  if (!userId) {
    const cookies = request.cookies;
    const authCookies = [
      "sb-fhkathpufpbkwzdfczgj-auth-token",
      "sb-fhkathpufpbkwzdfczgj-auth-token.0",
      "sb-fhkathpufpbkwzdfczgj-auth-token.1"
    ];
    
    for (const cookieName of authCookies) {
      const sbCookie = cookies.get(cookieName);
      if (sbCookie) {
        try {
          const tokenData = JSON.parse(sbCookie.value);
          if (tokenData?.user?.id) {
            userId = tokenData.user.id;
            break;
          }
        } catch {}
      }
    }
  }

  console.log("[Broker Callback] Processing for user:", userId);

  if (!userId) {
    console.error("[Broker Callback] No user_id found");
    return renderResult(false, "Session expired. Please close this window and try again from Settings.", "user");
  }

  try {
    const { data: account } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("api_key")
      .eq("user_id", userId)
      .eq("broker", "zerodha")
      .single();

    if (!account || !account.api_key) {
      console.error("[Broker Callback] No broker account found for user:", userId);
      return renderResult(false, "Please save your API keys first, then try again.", "user");
    }

    const { data: config } = await supabaseAdmin
      .from("user_config")
      .select("preferences")
      .eq("user_id", userId)
      .single();

    let apiSecret = "";
    if (config?.preferences) {
      const prefs = config.preferences as Record<string, string>;
      if (prefs.zerodha_api_secret) {
        try {
          apiSecret = decrypt(prefs.zerodha_api_secret);
        } catch {
          apiSecret = prefs.zerodha_api_secret;
        }
      }
    }

    if (!apiSecret) {
      console.error("[Broker Callback] No API secret found for user:", userId);
      return renderResult(false, "API Secret not found. Please save your credentials again.", "user");
    }

    let apiKey = "";
    try {
      apiKey = decrypt(account.api_key);
    } catch {
      apiKey = account.api_key;
    }

    const checksum = crypto
      .createHash("sha256")
      .update(apiKey + requestToken + apiSecret)
      .digest("hex");

    console.log("[Broker Callback] Exchanging token with API key:", apiKey.substring(0, 4) + "...");

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
    console.log("[Broker Callback] Token exchange response status:", tokenData.status);

    if (tokenData.status !== "success" || !tokenData.data?.access_token) {
      console.error("[Broker Callback] Token exchange failed:", tokenData.message);
      return renderResult(false, tokenData.message || "Token exchange failed. Please try again.", "user");
    }

    const accessToken = tokenData.data.access_token;
    const brokerUserId = tokenData.data.user_id;

    await supabaseAdmin
      .from("user_broker_accounts")
      .update({
        access_token: encrypt(accessToken),
        user_id_broker: brokerUserId,
        is_connected: true,
        is_authorized: true,
        last_connected_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("broker", "zerodha");

    console.log("[Broker Callback] Successfully connected broker for user:", userId, "broker_id:", brokerUserId);

    return renderResult(true, "Zerodha connected successfully!", "user");
  } catch (error) {
    console.error("[Broker Callback] Error:", error);
    return renderResult(false, "Server error. Please try again.", "user");
  }
}

async function handleAdminCallback(configId: string, requestToken: string) {
  try {
    const { data: config } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("*")
      .eq("id", configId)
      .single();

    if (!config) {
      console.error("[Admin Callback] No config found for id:", configId);
      return renderResult(false, "Configuration not found.", "admin");
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
      return renderResult(false, tokenData.message || "Token exchange failed.", "admin");
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

    return renderResult(true, "Zerodha authorized successfully!", "admin");
  } catch (error) {
    console.error("[Admin Callback] Error:", error);
    return renderResult(false, "Server error. Please try again.", "admin");
  }
}

function renderResult(success: boolean, message: string, type: "admin" | "user") {
  const messageType = type === "admin" ? "ZERODHA_ADMIN_AUTH_SUCCESS" : "ZERODHA_AUTH_SUCCESS";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${success ? "Zerodha Connected" : "Connection Failed"}</title>
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
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
    p { color: #888; margin: 0; font-size: 0.875rem; }
    .message { margin-bottom: 1rem; }
    .close-note { font-size: 0.75rem; opacity: 0.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon ${success ? "success" : "error"}">${success ? "✓" : "✕"}</div>
    <h1>${success ? "Connected!" : "Failed"}</h1>
    <p class="message">${message}</p>
    <p class="close-note">This window will close automatically...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: '${messageType}', success: ${success} }, '*');
    }
    setTimeout(() => {
      window.close();
    }, 2500);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
