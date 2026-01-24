import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { zerodhaService } from "@/lib/server/zerodha-service";
import { decrypt } from "@/lib/server/encryption";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface Signal {
  id: string;
  user_id: string;
  strategy_id: string;
  instrument_token: number;
  tradingsymbol: string;
  exchange: string;
  signal_type: "BUY" | "SELL";
  quantity: number;
  price: number | null;
  order_type: "MARKET" | "LIMIT";
  status: string;
  created_at: string;
}

interface TradingPreference {
  user_id: string;
  auto_trading_enabled: boolean;
  max_position_size: number;
  max_daily_trades: number;
  risk_per_trade: number;
}

interface BrokerAccount {
  id: string;
  user_id: string;
  api_key: string;
  access_token: string;
  is_active: boolean;
  is_connected: boolean;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: pendingSignals } = await supabaseAdmin
      .from("trading_signals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (!pendingSignals || pendingSignals.length === 0) {
      return successResponse({ success: true, executed: 0, message: "No pending signals" });
    }

    const results: Array<{ signalId: string; success: boolean; orderId?: string; error?: string }> = [];

    for (const signal of pendingSignals as Signal[]) {
      try {
        const result = await executeSignal(signal);
        results.push(result);
      } catch (error) {
        results.push({
          signalId: signal.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    await supabaseAdmin.from("system_health_logs").insert({
      metric_type: "signal_execution",
      metric_value: { total: results.length, successful, failed, results },
      severity: failed > 0 ? "warning" : "info",
      message: `Executed ${successful}/${results.length} signals`,
    });

    return successResponse({
      success: true,
      executed: successful,
      failed,
      results,
    });
  } catch (error) {
    console.error("[ExecuteSignals] Error:", error);
    return serverErrorResponse();
  }
}

async function executeSignal(signal: Signal): Promise<{ signalId: string; success: boolean; orderId?: string; error?: string }> {
  const { data: preference } = await supabaseAdmin
    .from("trading_preferences")
    .select("*")
    .eq("user_id", signal.user_id)
    .single();

  if (!preference || !(preference as TradingPreference).auto_trading_enabled) {
    await supabaseAdmin
      .from("trading_signals")
      .update({ status: "skipped", executed_at: new Date().toISOString(), error: "Auto-trading disabled" })
      .eq("id", signal.id);
    
    return { signalId: signal.id, success: false, error: "Auto-trading disabled for user" };
  }

  const { data: brokerAccount } = await supabaseAdmin
    .from("user_broker_accounts")
    .select("*")
    .eq("user_id", signal.user_id)
    .eq("is_active", true)
    .eq("is_connected", true)
    .single();

  let apiKey: string;
  let accessToken: string;

  if (brokerAccount) {
    const account = brokerAccount as BrokerAccount;
    try {
      apiKey = decrypt(account.api_key);
      accessToken = decrypt(account.access_token);
    } catch {
      const config = await zerodhaService.getActiveConfig();
      if (!config) {
        await supabaseAdmin
          .from("trading_signals")
          .update({ status: "failed", executed_at: new Date().toISOString(), error: "No broker connection" })
          .eq("id", signal.id);
        return { signalId: signal.id, success: false, error: "No broker connection" };
      }
      apiKey = config.apiKey;
      accessToken = config.accessToken;
    }
  } else {
    const config = await zerodhaService.getActiveConfig();
    if (!config) {
      await supabaseAdmin
        .from("trading_signals")
        .update({ status: "failed", executed_at: new Date().toISOString(), error: "No broker connection" })
        .eq("id", signal.id);
      return { signalId: signal.id, success: false, error: "No active broker connection" };
    }
    apiKey = config.apiKey;
    accessToken = config.accessToken;
  }

  const pref = preference as TradingPreference;
  const { count: todayTrades } = await supabaseAdmin
    .from("trade_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", signal.user_id)
    .gte("created_at", new Date().toISOString().split("T")[0]);

  if ((todayTrades || 0) >= pref.max_daily_trades) {
    await supabaseAdmin
      .from("trading_signals")
      .update({ status: "skipped", executed_at: new Date().toISOString(), error: "Daily trade limit reached" })
      .eq("id", signal.id);
    return { signalId: signal.id, success: false, error: "Daily trade limit reached" };
  }

  const orderParams = {
    tradingsymbol: signal.tradingsymbol,
    exchange: signal.exchange,
    transaction_type: signal.signal_type,
    order_type: signal.order_type,
    quantity: Math.min(signal.quantity, pref.max_position_size),
    product: "MIS",
    validity: "DAY",
    price: signal.order_type === "LIMIT" ? signal.price : undefined,
  };

  const formData = new URLSearchParams();
  Object.entries(orderParams).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, String(value));
    }
  });

  const response = await fetch("https://api.kite.trade/orders/regular", {
    method: "POST",
    headers: {
      "X-Kite-Version": "3",
      Authorization: `token ${apiKey}:${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const result = await response.json();

  if (!response.ok || result.status === "error") {
    await supabaseAdmin
      .from("trading_signals")
      .update({ 
        status: "failed", 
        executed_at: new Date().toISOString(), 
        error: result.message || "Order placement failed" 
      })
      .eq("id", signal.id);

    return { signalId: signal.id, success: false, error: result.message };
  }

  const orderId = result.data?.order_id;

  await supabaseAdmin
    .from("trading_signals")
    .update({ 
      status: "executed", 
      executed_at: new Date().toISOString(),
      order_id: orderId,
    })
    .eq("id", signal.id);

  await supabaseAdmin.from("trade_history").insert({
    user_id: signal.user_id,
    strategy_id: signal.strategy_id,
    signal_id: signal.id,
    order_id: orderId,
    tradingsymbol: signal.tradingsymbol,
    exchange: signal.exchange,
    transaction_type: signal.signal_type,
    quantity: orderParams.quantity,
    price: signal.price,
    order_type: signal.order_type,
    status: "placed",
  });

  return { signalId: signal.id, success: true, orderId };
}
