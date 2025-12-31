import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encryptCredential, decrypt } from "@/lib/server/encryption";
import crypto from "crypto";
import { getURL } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");
  
  const baseUrl = getURL();

  if (status === "error" || !requestToken) {
    console.error("[Broker Callback] OAuth failed - status:", status);
    return NextResponse.redirect(`${baseUrl}settings?broker_error=auth_failed`);
  }

  const actionParam = url.searchParams.get("action");
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
        access_token_encrypted: encryptCredential(accessToken),
        user_id_broker: brokerUserId,
        is_connected: true,
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
