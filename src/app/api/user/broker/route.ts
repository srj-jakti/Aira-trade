import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tradeExecutionEngine } from "@/lib/server/trade-execution-engine";
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
        api_key: account.api_key ? maskCredential("*".repeat(16)) : null,
        user_id_broker: account.user_id_broker ? maskCredential("*".repeat(8)) : null,
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
    const { apiKey, apiSecret, userIdBroker, password, totpSecret } = body;

    if (!apiKey || !apiSecret || !userIdBroker || !password || !totpSecret) {
      return badRequestResponse("All credentials are required");
    }

    const result = await tradeExecutionEngine.connectUserBroker(user.userId, {
      apiKey,
      apiSecret,
      userIdBroker,
      password,
      totpSecret,
    });

    if (!result.success) {
      return successResponse({ success: false, error: result.error });
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error connecting broker:", error);
    return serverErrorResponse();
  }
}

export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    await tradeExecutionEngine.disconnectUserBroker(user.userId);
    return successResponse({ success: true });
  } catch (error) {
    console.error("Error disconnecting broker:", error);
    return serverErrorResponse();
  }
}
