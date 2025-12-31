import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { maskCredential } from "@/lib/server/encryption";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    const { data: account } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("id, broker, is_connected, last_connected_at, last_error, is_active, created_at, user_id_broker, api_key")
      .eq("user_id", user.userId)
      .single();

    if (!account) {
      return successResponse({ account: null });
    }

    return successResponse({
      account: {
        ...account,
        api_key: account.api_key ? maskCredential(account.api_key) : null,
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
    const { apiKey } = body;

    if (!apiKey) {
      return badRequestResponse("API Key is required");
    }

    await supabaseAdmin
      .from("user_broker_accounts")
      .upsert({
        user_id: user.userId,
        broker: "zerodha",
        api_key: apiKey,
        is_connected: false,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

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
        access_token_encrypted: null,
        last_error: "Disconnected by user",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.userId);

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error disconnecting broker:", error);
    return serverErrorResponse();
  }
}
