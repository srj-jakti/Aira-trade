import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/server/encryption";

export async function POST(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    const { data: configData, error: configError } = await supabaseAdmin
      .from("user_config")
      .select("preferences")
      .eq("user_id", user.userId)
      .single();

    if (configError || !configData?.preferences) {
      return badRequestResponse("Please save your API keys first");
    }

    const prefs = configData.preferences as Record<string, string>;
    const encryptedApiKey = prefs.zerodha_api_key;
    const encryptedApiSecret = prefs.zerodha_api_secret;

    if (!encryptedApiKey) {
      return badRequestResponse("API Key not found. Please save your credentials first.");
    }
    if (!encryptedApiSecret) {
      return badRequestResponse("API Secret not found. Please save your credentials first.");
    }

    let apiKey: string;
    let apiSecret: string;
    try {
      apiKey = decrypt(encryptedApiKey);
    } catch {
      return badRequestResponse("Invalid API Key. Please re-enter your credentials.");
    }
    try {
      apiSecret = decrypt(encryptedApiSecret);
    } catch {
      return badRequestResponse("Invalid API Secret. Please re-enter your credentials.");
    }

    const { error } = await supabaseAdmin
      .from("user_broker_accounts")
      .upsert({
        user_id: user.userId,
        broker: "zerodha",
        api_key: encrypt(apiKey),
        api_secret: encrypt(apiSecret),
        user_id_broker: "",
        is_connected: false,
        is_authorized: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,broker" });

    if (error) {
      return serverErrorResponse(error.message);
    }

    const loginUrl = `https://kite.trade/connect/login?v=3&api_key=${apiKey}&redirect_params=user_id=${user.userId}`;

    return successResponse({ 
      loginUrl,
      message: "Open the login URL in a popup to authenticate with Zerodha"
    });
  } catch (error) {
    console.error("Error initiating OAuth:", error);
    return serverErrorResponse();
  }
}
