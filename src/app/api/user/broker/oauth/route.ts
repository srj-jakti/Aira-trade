import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";
import { getURL } from "@/lib/utils";

export async function POST(request: NextRequest) {
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

    if (!encryptedApiKey) {
      return badRequestResponse("API Key not found. Please save your credentials first.");
    }

    let apiKey: string;
    try {
      apiKey = decrypt(encryptedApiKey);
    } catch {
      return badRequestResponse("Invalid API Key. Please re-enter your credentials.");
    }

    await supabaseAdmin
      .from("user_broker_accounts")
      .upsert({
        user_id: user.userId,
        broker: "zerodha",
        api_key: apiKey,
        is_connected: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

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
