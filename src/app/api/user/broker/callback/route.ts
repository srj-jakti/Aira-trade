import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/server/encryption";
import crypto from "crypto";
import { getURL } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");
  const adminConfigId = url.searchParams.get("admin_config_id");
  
  const baseUrl = getURL();

  if (status === "error" || !requestToken) {
    console.error("[Broker Callback] OAuth failed - status:", status);
    if (adminConfigId) {
      return renderAdminResult(false, "Authentication failed. Please try again.");
    }
    return NextResponse.redirect(`${baseUrl}settings?broker_error=auth_failed`);
  }

  if (adminConfigId) {
    return handleAdminCallback(adminConfigId, requestToken);
  }

  const userIdParam = url.searchParams.get("user_id");

  let userId: string | null = userIdParam;

  if (!userId) {
    const cookies = request.cookies;
    const sbCookie = cookies.get("sb-fhkathpufpbkwzdfczgj-auth-token");
    if (sbCookie) {
      try {
        const tokenData = JSON.parse(sbCookie.value);
        if (tokenData?.user?.id) {
          userId = tokenData.user.id;
        }
      } catch {}
    }
  }

  if (!userId) {
    const { data: { user } } = await supabaseAdmin.auth.getUser();
    if (user?.id) {
      userId = user.id;
    }
  }

  console.log("[Broker Callback] Processing for user:", userId, "request_token:", requestToken?.substring(0, 10) + "...");

  if (!userId) {
    console.error("[Broker Callback] No user_id found");
    return NextResponse.redirect(`${baseUrl}settings?broker_error=missing_user`);
  }

  try {
    const { data: account } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("api_key")
      .eq("user_id", userId)
      .single();

    if (!account || !account.api_key) {
      console.error("[Broker Callback] No broker account found for user:", userId);
      return NextResponse.redirect(`${baseUrl}settings?broker_error=no_account`);
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
      return NextResponse.redirect(`${baseUrl}settings?broker_error=no_secret`);
    }

    const checksum = crypto
      .createHash("sha256")
      .update(account.api_key + requestToken + apiSecret)
      .digest("hex");

    console.log("[Broker Callback] Exchanging token with API key:", account.api_key.substring(0, 4) + "...");

    const tokenResp = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Kite-Version": "3",
      },
      body: new URLSearchParams({
        api_key: account.api_key,
        request_token: requestToken,
        checksum: checksum,
      }).toString(),
    });

    const tokenData = await tokenResp.json();
    console.log("[Broker Callback] Token exchange response status:", tokenData.status);

    if (tokenData.status !== "success" || !tokenData.data?.access_token) {
      console.error("[Broker Callback] Token exchange failed:", tokenData.message);
      return NextResponse.redirect(`${baseUrl}settings?broker_error=token_failed`);
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
      .eq("user_id", userId);

    console.log("[Broker Callback] Successfully connected broker for user:", userId, "broker_id:", brokerUserId);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Zerodha Connected</title>
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
    .success { color: #22c55e; font-size: 4rem; margin-bottom: 1rem; }
    h1 { margin: 0 0 0.5rem; }
    p { color: #888; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✓</div>
    <h1>Zerodha Connected!</h1>
    <p>You can close this window now.</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'ZERODHA_AUTH_SUCCESS' }, '*');
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("[Broker Callback] Error:", error);
    return NextResponse.redirect(`${baseUrl}settings?broker_error=server_error`);
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
      return renderAdminResult(false, "Configuration not found.");
    }

    const apiKey = decrypt(config.api_key);
    const apiSecret = decrypt(config.api_secret);

    const checksum = crypto
      .createHash("sha256")
      .update(apiKey + requestToken + apiSecret)
      .digest("hex");

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
      return renderAdminResult(false, tokenData.message || "Token exchange failed.");
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

    console.log("[Admin Callback] Successfully authorized config:", config.id);

    return renderAdminResult(true, "Zerodha authorized successfully!");
  } catch (error) {
    console.error("[Admin Callback] Error:", error);
    return renderAdminResult(false, "Server error. Please try again.");
  }
}

function renderAdminResult(success: boolean, message: string) {
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
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
