"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function getDashboardStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    const [configRes, prefsRes, engineStatusRes, recentSignalsRes] = await Promise.all([
      supabase.from("config").select("zerodha_connection_status").single().then(r => r, e => ({ data: null, error: e })),
      supabase.from("trading_preferences").select("*").eq("user_id", user.id).single().then(r => r, e => ({ data: null, error: e })),
      supabaseAdmin.from("trading_engine_status").select("*").eq("engine_type", "trading_engine").single().then(r => r, e => ({ data: null, error: e })),
      supabase.from("ai_signals").select("id, signal_status, status_reason, tradingsymbol, direction, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5).then(r => r, e => ({ data: null, error: e }))
    ]);

    const prefs = prefsRes.data;
    const engineStatus = engineStatusRes.data;
    const isPaperMode = prefs?.paper_trading_enabled || false;

    let balance = { total: "10,00,000.00", available: "10,00,000.00" };
    let pl = { total: "0.00", day: "0.00", isPositive: true };
    let activePositions: any[] = [];
    let recentOrders: any[] = [];

    if (isPaperMode) {
      const [posRes, histRes, orderRes] = await Promise.all([
        supabase.from("paper_positions").select("*").eq("user_id", user.id).eq("status", "open"),
        supabase.from("paper_trade_history").select("pnl").eq("user_id", user.id),
        supabase.from("paper_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
      ]);

      if (posRes.data) {
        activePositions = posRes.data.map((p: any) => ({
          id: p.id,
          symbol: p.tradingsymbol,
          type: p.position_type,
          qty: p.quantity,
          avgPrice: p.entry_price.toFixed(2),
          pl: (p.unrealized_pnl >= 0 ? "+" : "") + p.unrealized_pnl.toFixed(2),
          plPercent: p.unrealized_pnl_percent.toFixed(2) + "%"
        }));
      }

      if (histRes.data) {
        const totalPnl = histRes.data.reduce((sum: number, trade: any) => sum + Number(trade.pnl), 0);
        const unrealizedPnl = posRes.data?.reduce((sum: number, p: any) => sum + Number(p.unrealized_pnl), 0) || 0;
        const netPnl = totalPnl + unrealizedPnl;
        pl = {
          total: netPnl.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          day: totalPnl.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          isPositive: netPnl >= 0
        };
        balance = {
          total: (1000000 + netPnl).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          available: (1000000 + totalPnl).toLocaleString("en-IN", { minimumFractionDigits: 2 })
        };
      }

      if (orderRes.data) {
        recentOrders = orderRes.data;
      }
    }

    return {
      connectionStatus: configRes.data?.zerodha_connection_status || "disconnected",
      autoTradingEnabled: prefs?.auto_trading_enabled || false,
      paperTradingEnabled: isPaperMode,
      balance,
      pl,
      activePositions,
      recentOrders,
      tradingEngine: {
        status: engineStatus?.status || "stopped",
        lastHeartbeat: engineStatus?.last_heartbeat,
        activeUsers: engineStatus?.active_users || 0,
        errorMessage: engineStatus?.error_message
      },
      userTradingStatus: {
        lastEvaluation: prefs?.last_evaluation_at,
        nextEvaluation: prefs?.next_evaluation_at,
        evaluationError: prefs?.evaluation_error,
        consecutiveFailures: prefs?.consecutive_failures || 0,
        strategyType: prefs?.strategy_type || "intraday"
      },
      recentSignals: recentSignalsRes.data || []
    };
  } catch (error) {
    console.error("Error fetching dashboard status:", error);
    return null;
  }
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
