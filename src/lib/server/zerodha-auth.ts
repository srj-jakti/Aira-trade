import * as OTPAuth from "otpauth";
import crypto from "crypto";

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Content-Type": "application/x-www-form-urlencoded",
  "Origin": "https://kite.zerodha.com",
  "Referer": "https://kite.zerodha.com/",
  "X-Kite-Version": "3",
};

function extractCookies(response: Response): string[] {
  const cookies: string[] = [];
  
  // @ts-ignore - getSetCookie is available in modern Node.js
  if (typeof response.headers.getSetCookie === 'function') {
    // @ts-ignore
    const setCookies = response.headers.getSetCookie();
    setCookies.forEach((c: string) => {
      const part = c.split(';')[0];
      if (part && !cookies.includes(part)) cookies.push(part);
    });
  }
  
  // Fallback: also try raw set-cookie header
  if (cookies.length === 0) {
    const raw = response.headers.get('set-cookie');
    if (raw) {
      raw.split(/,\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/).forEach(c => {
        const part = c.trim().split(';')[0];
        if (part && !cookies.includes(part)) cookies.push(part);
      });
    }
  }
  return cookies;
}

export async function performZerodhaFullLogin(config: {
  api_key: string;
  api_secret: string;
  user_id: string;
  password: string;
  totp_secret: string;
}): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    console.log("[Zerodha Auth] Step 1: Starting login for user:", config.user_id);
    
    // ----------------------------------------
    // STEP 1: LOGIN
    // ----------------------------------------
    const loginResp = await fetch("https://kite.zerodha.com/api/login", {
      method: "POST",
      headers: BASE_HEADERS,
      body: new URLSearchParams({
        user_id: config.user_id,
        password: config.password,
      }).toString(),
    });

    const loginData = await loginResp.json();
    console.log("[Zerodha Auth] Step 1 Response status:", loginResp.status, "data:", JSON.stringify(loginData));
    
    if (!loginResp.ok || loginData.status !== "success") {
      return { success: false, error: loginData.message || "Login step failed" };
    }

    const requestId = loginData.data.request_id;
    const loginCookies = extractCookies(loginResp);
    console.log("[Zerodha Auth] Step 1 Success - request_id:", requestId, "cookies count:", loginCookies.length);
    console.log("[Zerodha Auth] Cookies received:", loginCookies);

    // ----------------------------------------
    // STEP 2: 2FA GENERATION & SUBMISSION
    // ----------------------------------------
    const secret = config.totp_secret.replace(/\s+/g, "");
    const totp = new OTPAuth.TOTP({
      issuer: "Zerodha",
      label: config.user_id,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const totpCode = totp.generate();
    console.log("[Zerodha Auth] Step 2: Generated TOTP code:", totpCode);

    // Note: Zerodha's newer API does NOT require twofa_type parameter
    const twofaBody = new URLSearchParams({
      user_id: config.user_id,
      request_id: requestId,
      twofa_value: totpCode,
    });

    console.log("[Zerodha Auth] Step 2: Sending 2FA with cookies:", loginCookies.join("; "));
    
    const twofaResp = await fetch("https://kite.zerodha.com/api/twofa", {
      method: "POST",
      headers: {
        ...BASE_HEADERS,
        "Cookie": loginCookies.join("; "),
      },
      body: twofaBody.toString(),
    });

    const twofaData = await twofaResp.json();
    console.log("[Zerodha Auth] Step 2 Response status:", twofaResp.status, "data:", JSON.stringify(twofaData));
    
    if (!twofaResp.ok || twofaData.status !== "success") {
      return { success: false, error: twofaData.message || "2FA step failed" };
    }

    const twofaCookies = extractCookies(twofaResp);
    const allCookies = [...loginCookies, ...twofaCookies];
    console.log("[Zerodha Auth] Step 2 Success - total cookies:", allCookies.length);
    
    // Extract enctoken
    let enctoken = null;
    allCookies.forEach(c => {
      if (c.startsWith("enctoken=")) enctoken = c.split("=")[1];
    });

    console.log("[Zerodha Auth] Enctoken found:", enctoken ? "Yes" : "No");

    if (!enctoken) {
      return { success: false, error: "Failed to obtain enctoken from cookies" };
    }

    // ----------------------------------------
    // STEP 3: OAUTH AUTHORIZATION FLOW
    // ----------------------------------------
    console.log("[Zerodha Auth] Step 3: Starting OAuth flow");
    const oauthUrl = `https://kite.trade/connect/login?v=3&api_key=${config.api_key}`;
    const cookieString = `enctoken=${enctoken}; ${allCookies.join("; ")}`;
    
    let currentUrl = oauthUrl;
    let requestToken = null;
    
    // Follow redirects manually
    for (let i = 0; i < 10; i++) {
      console.log(`[Zerodha Auth] Step 3 Redirect #${i + 1}: ${currentUrl.substring(0, 80)}...`);
      
      const resp = await fetch(currentUrl, {
        method: "GET",
        headers: {
          ...BASE_HEADERS,
          "Cookie": cookieString
        },
        redirect: "manual"
      });

      console.log(`[Zerodha Auth] Step 3 Response status: ${resp.status}`);

      if ([301, 302, 307].includes(resp.status)) {
        const location = resp.headers.get("location");
        console.log("[Zerodha Auth] Redirect location:", location);
        if (!location) break;

        const match = location.match(/[?&]request_token=([^&]+)/);
        if (match) {
          requestToken = match[1];
          console.log("[Zerodha Auth] Found request_token in redirect!");
          break;
        }

        currentUrl = location.startsWith("http") ? location : `https://kite.zerodha.com${location}`;
      } 
      else if (resp.status === 200) {
        const text = await resp.text();
        console.log("[Zerodha Auth] Got 200 response, checking for token in body...");
        
        const match = text.match(/[?&]request_token=([^&"'\s]+)/);
        if (match) {
          requestToken = match[1];
          console.log("[Zerodha Auth] Found request_token in body!");
          break;
        }

        if (text.includes("Authorize")) {
          console.log("[Zerodha Auth] Hit Authorize page, attempting auto-approve...");
          const sessIdMatch = currentUrl.match(/[?&]sess_id=([^&]+)/);
          if (!sessIdMatch) {
            console.log("[Zerodha Auth] No sess_id found in URL");
            break;
          }
          
          const actionUrl = `https://kite.zerodha.com/connect/login?api_key=${config.api_key}&sess_id=${sessIdMatch[1]}`;
          console.log("[Zerodha Auth] Auto-approve URL:", actionUrl);
          
          const approveResp = await fetch(actionUrl, {
            method: "POST",
            headers: { ...BASE_HEADERS, "Cookie": cookieString },
            body: new URLSearchParams({ skipApi: "true" }).toString(),
            redirect: "manual"
          });
          
          console.log("[Zerodha Auth] Auto-approve response status:", approveResp.status);
          const loc = approveResp.headers.get("location");
          console.log("[Zerodha Auth] Auto-approve redirect:", loc);
          
          if (loc) {
            const rtMatch = loc.match(/request_token=([^&]+)/);
            if (rtMatch) {
              requestToken = rtMatch[1];
              console.log("[Zerodha Auth] Found request_token after auto-approve!");
              break;
            }
          }
        }
        
        console.log("[Zerodha Auth] Page content (first 500 chars):", text.substring(0, 500));
        break;
      } else {
        console.log("[Zerodha Auth] Unexpected status, breaking loop");
        break;
      }
    }

    if (!requestToken) {
      return { success: false, error: "Failed to obtain request_token after redirects" };
    }

    // ----------------------------------------
    // STEP 4: EXCHANGE FOR ACCESS TOKEN
    // ----------------------------------------
    console.log("[Zerodha Auth] Step 4: Exchanging request_token for access_token");
    const checksum = crypto
      .createHash("sha256")
      .update(config.api_key + requestToken + config.api_secret)
      .digest("hex");

    const tokenResp = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Kite-Version": "3",
      },
      body: new URLSearchParams({
        api_key: config.api_key,
        request_token: requestToken,
        checksum: checksum,
      }).toString(),
    });

    const tokenData = await tokenResp.json();
    console.log("[Zerodha Auth] Step 4 Response:", JSON.stringify(tokenData));
    
    if (tokenData.status === "success" && tokenData.data?.access_token) {
      console.log("[Zerodha Auth] SUCCESS! Access token obtained");
      return { success: true, accessToken: tokenData.data.access_token };
    } else {
      return { success: false, error: tokenData.message || "Token exchange failed" };
    }

  } catch (err) {
    console.error("Zerodha full login exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
