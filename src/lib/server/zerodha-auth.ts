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

const DEBUG = false;

function log(...args: unknown[]) {
  if (DEBUG) console.log(...args);
}

function extractCookies(response: Response, existingCookies: Map<string, string> = new Map()): Map<string, string> {
  const cookieMap = new Map(existingCookies);
  
  const getCookiesFromHeader = (header: string | null) => {
    if (!header) return;
    header.split(/,\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/).forEach(c => {
      const cookiePart = c.trim().split(';')[0];
      if (cookiePart) {
        const [name, ...valueParts] = cookiePart.split('=');
        if (name) cookieMap.set(name.trim(), valueParts.join('='));
      }
    });
  };

    if (typeof (response.headers as any).getSetCookie === 'function') {
      const setCookies = (response.headers as any).getSetCookie();
    setCookies.forEach((c: string) => {
      const cookiePart = c.split(';')[0];
      if (cookiePart) {
        const [name, ...valueParts] = cookiePart.split('=');
        if (name) cookieMap.set(name.trim(), valueParts.join('='));
      }
    });
  } else {
    getCookiesFromHeader(response.headers.get('set-cookie'));
  }
  
  return cookieMap;
}

function cookieMapToString(cookieMap: Map<string, string>): string {
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export async function performZerodhaFullLogin(config: {
  api_key: string;
  api_secret: string;
  user_id: string;
  password: string;
  totp_secret: string;
}): Promise<{ success: boolean; accessToken?: string; error?: string; requiresManualAuth?: boolean; authUrl?: string }> {
  try {
    log("[Zerodha Auth] Starting login for user:", config.user_id);
    
    let cookies = new Map<string, string>();

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
    const userId = loginData.data.user_id || config.user_id;
    cookies = extractCookies(loginResp, cookies);
    log("[Zerodha Auth] Step 1 Success, Cookies count:", cookies.size);

    const secret = config.totp_secret.replace(/\s+/g, "");
    const totp = new OTPAuth.TOTP({
      issuer: "Zerodha",
      label: userId,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const totpCode = totp.generate();

    const twofaBody = new URLSearchParams({
      user_id: userId,
      request_id: requestId,
      twofa_value: totpCode,
      twofa_type: "totp",
    });

    const twofaResp = await fetch("https://kite.zerodha.com/api/twofa", {
      method: "POST",
      headers: {
        ...BASE_HEADERS,
        "Cookie": cookieMapToString(cookies),
      },
      body: twofaBody.toString(),
    });

    const twofaData = await twofaResp.json();
    
    if (!twofaResp.ok || twofaData.status !== "success") {
      return { success: false, error: twofaData.message || "2FA step failed" };
    }

    cookies = extractCookies(twofaResp, cookies);
    log("[Zerodha Auth] Step 2 Success, Cookies count:", cookies.size);
    
    log("[Zerodha Auth] Solidifying session...");
    const homeResp = await fetch("https://kite.zerodha.com/dashboard", {
      headers: {
        ...BASE_HEADERS,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Cookie": cookieMapToString(cookies),
      }
    });
    cookies = extractCookies(homeResp, cookies);
    
    const enctoken = cookies.get("enctoken");
    if (!enctoken) {
      return { success: false, error: "Failed to obtain enctoken from cookies" };
    }

    log("[Zerodha Auth] Step 3: Starting OAuth flow");
    const oauthUrl = `https://kite.trade/connect/login?v=3&api_key=${config.api_key}`;
    
    let currentUrl = oauthUrl;
    let requestToken = null;
    
    for (let i = 0; i < 10; i++) {
      const cookieString = cookieMapToString(cookies);
      log("[Zerodha Auth] OAuth loop", i, "URL:", currentUrl);
      
      const oauthHeaders: Record<string, string> = {
        "User-Agent": BASE_HEADERS["User-Agent"],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "max-age=0",
        "Connection": "keep-alive",
        "Cookie": cookieString,
      };
      
      if (enctoken && currentUrl.includes("kite.zerodha.com")) {
        oauthHeaders["Authorization"] = `enctoken ${enctoken}`;
      }
      
      const resp = await fetch(currentUrl, {
        method: "GET",
        headers: oauthHeaders,
        redirect: "manual"
      });

      log("[Zerodha Auth] OAuth response status:", resp.status);
      cookies = extractCookies(resp, cookies);

      if ([301, 302, 307].includes(resp.status)) {
        const location = resp.headers.get("location");
        log("[Zerodha Auth] Redirecting to:", location);
        if (!location) break;

        const match = location.match(/[?&]request_token=([^&]+)/);
        if (match) {
          requestToken = match[1];
          log("[Zerodha Auth] Found request_token in redirect:", requestToken);
          break;
        }

        currentUrl = location.startsWith("http") ? location : `https://kite.zerodha.com${location}`;
      } else if (resp.status === 200) {
        const text = await resp.text();
        log("[Zerodha Auth] 200 OK, text length:", text.length, "URL:", currentUrl);
        
        const match = text.match(/[?&]request_token=([^&"'\s]+)/);
        if (match) {
          requestToken = match[1];
          log("[Zerodha Auth] Found request_token in text:", requestToken);
          break;
        }

        const isAuthorizePage = currentUrl.includes("/connect/authorize");
        const hasAuthorizeButton = text.includes("Authorize");
        log("[Zerodha Auth] isAuthorizePage:", isAuthorizePage, "hasAuthorizeButton:", hasAuthorizeButton);
        
        if (isAuthorizePage || hasAuthorizeButton) {
          log("[Zerodha Auth] API key needs first-time manual authorization");
          return { 
            success: false, 
            error: `API key requires first-time manual authorization. Please visit: https://kite.trade/connect/login?v=3&api_key=${config.api_key} in your browser while logged into Zerodha to authorize this app.`,
            requiresManualAuth: true,
            authUrl: `https://kite.trade/connect/login?v=3&api_key=${config.api_key}`
          };
        } else {
          log("[Zerodha Auth] No request_token found in 200 OK response");
          log("[Zerodha Auth] Response text snippet:", text.substring(0, 500));
        }
        break;
      } else {
        log("[Zerodha Auth] Unexpected status:", resp.status);
        break;
      }
    }

    if (!requestToken) {
      return { success: false, error: "Failed to obtain request_token after redirects" };
    }

    log("[Zerodha Auth] Step 4: Exchanging for access token");
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
      log("[Zerodha Auth] SUCCESS");
      return { success: true, accessToken: tokenData.data.access_token };
    } else {
      return { success: false, error: tokenData.message || "Token exchange failed" };
    }

  } catch (err) {
    console.error("Zerodha login error:", err instanceof Error ? err.message : "Unknown error");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
