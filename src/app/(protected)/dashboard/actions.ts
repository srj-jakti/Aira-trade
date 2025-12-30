"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getDashboardStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [configRes, prefsRes] = await Promise.all([
    supabase.from("config").select("zerodha_connection_status").single(),
    supabase.from("trading_preferences").select("auto_trading_enabled").eq("user_id", user.id).single()
  ]);

  return {
    connectionStatus: configRes.data?.zerodha_connection_status || "disconnected",
    autoTradingEnabled: prefsRes.data?.auto_trading_enabled || false
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
