import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt, maskCredential } from "@/lib/server/encryption";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    const { data: account } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("id, broker, is_connected, last_connected_at, last_error, is_active, created_at, user_id_broker, api_key")
      .eq("user_id", user.userId)
      .eq("broker", "zerodha")
      .single();

    if (!account) {
      return successResponse({ account: null });
    }

    return successResponse({
      account: {
        ...account,
        api_key: account.api_key ? maskCredential(safeDecrypt(account.api_key)) : null,
        user_id_broker: account.user_id_broker || null,
      },
    });
  } catch (error) {
    console.error("Error fetching broker account:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { apiKey, apiSecret } = body;

    if (!apiKey || !apiSecret) {
      return badRequestResponse("API Key and API Secret are required");
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
        is_active: true,
        is_authorized: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,broker" });

    if (error) {
      return serverErrorResponse(error.message);
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error saving broker account:", error);
    return serverErrorResponse();
  }
}

export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    await supabaseAdmin
      .from("user_broker_accounts")
      .update({
        is_connected: false,
        access_token: null,
        last_error: "Disconnected by user",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.userId)
      .eq("broker", "zerodha");

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error disconnecting broker:", error);
    return serverErrorResponse();
  }
}

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}
