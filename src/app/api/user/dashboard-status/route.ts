import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, avatar_url, is_approved, created_at")
      .eq("id", auth.userId)
      .single();

    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_name, status, current_period_end")
      .eq("user_id", auth.userId)
      .single();

    const { data: tradingPrefs } = await supabaseAdmin
      .from("trading_preferences")
      .select("auto_trading_enabled")
      .eq("user_id", auth.userId)
      .single();

    const { count: tradeCount } = await supabaseAdmin
      .from("trade_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId);

    return successResponse({
      profile: profile || null,
      subscription: subscription || null,
      tradingEnabled: tradingPrefs?.auto_trading_enabled || false,
      totalTrades: tradeCount || 0,
    });
  } catch {
    return serverErrorResponse();
  }
}
