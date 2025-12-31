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
  } else {
    const raw = response.headers.get('set-cookie');
    if (raw) {
      // Basic fallback for older environments
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
    if (!loginResp.ok || loginData.status !== "success") {
      return { success: false, error: loginData.message || "Login step failed" };
    }

    const requestId = loginData.data.request_id;
    const loginCookies = extractCookies(loginResp);

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

    const twofaResp = await fetch("https://kite.zerodha.com/api/twofa", {
      method: "POST",
      headers: {
        ...BASE_HEADERS,
        "Cookie": loginCookies.join("; "),
      },
      body: new URLSearchParams({
        user_id: config.user_id,
        request_id: requestId,
        twofa_value: totpCode,
        twofa_type: "totp",
      }).toString(),
    });

    const twofaData = await twofaResp.json();
    if (!twofaResp.ok || twofaData.status !== "success") {
      return { success: false, error: twofaData.message || "2FA step failed" };
    }

    const twofaCookies = extractCookies(twofaResp);
    const allCookies = [...loginCookies, ...twofaCookies];
    
    // Extract enctoken
    let enctoken = null;
    allCookies.forEach(c => {
      if (c.startsWith("enctoken=")) enctoken = c.split("=")[1];
    });

    if (!enctoken) {
      return { success: false, error: "Failed to obtain enctoken from cookies" };
    }

    // ----------------------------------------
    // STEP 3: OAUTH AUTHORIZATION FLOW
    // ----------------------------------------
    const oauthUrl = `https://kite.trade/connect/login?v=3&api_key=${config.api_key}`;
    const cookieString = `enctoken=${enctoken}; ${allCookies.join("; ")}`;
    
    let currentUrl = oauthUrl;
    let requestToken = null;
    
    // Follow redirects manually
    for (let i = 0; i < 10; i++) {
      const resp = await fetch(currentUrl, {
        method: "GET",
        headers: {
          ...BASE_HEADERS,
          "Cookie": cookieString
        },
        redirect: "manual"
      });

      if ([301, 302, 307].includes(resp.status)) {
        const location = resp.headers.get("location");
        if (!location) break;

        const match = location.match(/[?&]request_token=([^&]+)/);
        if (match) {
          requestToken = match[1];
          break;
        }

        currentUrl = location.startsWith("http") ? location : `https://kite.zerodha.com${location}`;
      } 
      else if (resp.status === 200) {
        const text = await resp.text();
        const match = text.match(/[?&]request_token=([^&"'\s]+)/);
        if (match) {
          requestToken = match[1];
          break;
        }

        if (text.includes("Authorize")) {
          const sessIdMatch = currentUrl.match(/[?&]sess_id=([^&]+)/);
          if (!sessIdMatch) break;
          
          const actionUrl = `https://kite.zerodha.com/connect/login?api_key=${config.api_key}&sess_id=${sessIdMatch[1]}`;
          
          const approveResp = await fetch(actionUrl, {
            method: "POST",
            headers: { ...BASE_HEADERS, "Cookie": cookieString },
            body: new URLSearchParams({ skipApi: "true" }).toString(),
            redirect: "manual"
          });
          
          const loc = approveResp.headers.get("location");
          if (loc) {
            const rtMatch = loc.match(/request_token=([^&]+)/);
            if (rtMatch) {
              requestToken = rtMatch[1];
              break;
            }
          }
        }
        break;
      } else {
        break;
      }
    }

    if (!requestToken) {
      return { success: false, error: "Failed to obtain request_token after redirects" };
    }

    // ----------------------------------------
    // STEP 4: EXCHANGE FOR ACCESS TOKEN
    // ----------------------------------------
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
    
    if (tokenData.status === "success" && tokenData.data?.access_token) {
      return { success: true, accessToken: tokenData.data.access_token };
    } else {
      return { success: false, error: tokenData.message || "Token exchange failed" };
    }

  } catch (err) {
    console.error("Zerodha full login exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
