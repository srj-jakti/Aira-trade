import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getURL } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return badRequestResponse("API Key is required");
    }

    const baseUrl = getURL();
    const redirectUrl = `${baseUrl}api/user/broker/callback`;

    const loginUrl = `https://kite.trade/connect/login?v=3&api_key=${apiKey}&redirect_params=user_id=${user.userId}`;

    await supabaseAdmin
      .from("user_broker_accounts")
      .upsert({
        user_id: user.userId,
        broker: "zerodha",
        api_key: apiKey,
        is_connected: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    return successResponse({ 
      loginUrl,
      redirectUrl,
      message: "Open the login URL in a popup to authenticate with Zerodha"
    });
  } catch (error) {
    console.error("Error initiating OAuth:", error);
    return badRequestResponse("Failed to initiate OAuth flow");
  }
}
