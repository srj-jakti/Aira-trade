"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function getDashboardStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [configRes, prefsRes, engineStatusRes, recentSignalsRes] = await Promise.all([
    supabase.from("config").select("zerodha_connection_status").single(),
    supabase.from("trading_preferences").select("*").eq("user_id", user.id).single(),
    supabaseAdmin.from("trading_engine_status").select("*").eq("engine_type", "trading_engine").single(),
    supabase.from("ai_signals").select("id, signal_status, status_reason, tradingsymbol, direction, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
  ]);

  const prefs = prefsRes.data;
  const engineStatus = engineStatusRes.data;

  return {
    connectionStatus: configRes.data?.zerodha_connection_status || "disconnected",
    autoTradingEnabled: prefs?.auto_trading_enabled || false,
    tradingEngine: {
      status: engineStatus?.status || "stopped",
      lastHeartbeat: engineStatus?.last_heartbeat,
      activeUsers: engineStatus?.active_users || 0,
      errorMessage: engineStatus?.error_message,
    },
    userTradingStatus: {
      lastEvaluation: prefs?.last_evaluation_at,
      nextEvaluation: prefs?.next_evaluation_at,
      evaluationError: prefs?.evaluation_error,
      consecutiveFailures: prefs?.consecutive_failures || 0,
      strategyType: prefs?.strategy_type || "intraday",
    },
    recentSignals: recentSignalsRes.data || [],
  };
}

export async function toggleAiTrading(enabled: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("trading_preferences")
    .update({ auto_trading_enabled: enabled })
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function togglePaperTrading(enabled: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("trading_preferences")
    .update({ paper_trading_enabled: enabled })
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  
  revalidatePath("/dashboard");
  return { success: true };
}

export async function resetPaperBalance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  try {
    await Promise.all([
      supabase.from("paper_orders").delete().eq("user_id", user.id),
      supabase.from("paper_positions").delete().eq("user_id", user.id),
      supabase.from("paper_trade_history").delete().eq("user_id", user.id),
    ]);

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error resetting paper balance:", error);
    return { error: "Failed to reset paper balance" };
  }
}
