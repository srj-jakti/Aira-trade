import { supabase } from "./utils/supabase";
import { logger } from "./utils/logger";
import { Signal } from "./executor";

export type SignalStatus =
  | "PENDING"
  | "PENDING_EXECUTION"
  | "EXECUTING"
  | "EXECUTED"
  | "FILLED"
  | "PARTIALLY_FILLED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";

export async function createSignal(
  userId: string,
  strategyId: string | null,
  signal: Signal,
  status: SignalStatus,
  signalType: "TRADING" | "SCANNER" = "TRADING"
): Promise<string> {
  const { data, error } = await supabase
    .from("ai_signals")
    .insert({
      user_id: userId,
      strategy_id: strategyId,
      direction: signal.action,
      tradingsymbol: signal.instrument,
      instrument_token: signal.instrumentToken,
      entry_price: signal.price,
      sl_price: signal.stopLoss,
      target_price: signal.target,
      confidence: signal.confidence,
      signal_status: status,
      signal_type: signalType,
      status_updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create signal", error);
    throw error;
  }
  
  return data.id;
}

export async function updateSignalStatus(
  signalId: string,
  status: SignalStatus,
  reason: string,
  orderId?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    signal_status: status,
    status_reason: reason,
    status_updated_at: new Date().toISOString(),
  };

  if (orderId) {
    update.broker_order_id = orderId;
  }

  const { error } = await supabase
    .from("ai_signals")
    .update(update)
    .eq("id", signalId);

  if (error) {
    logger.error("Failed to update signal status", error);
  }
}

export async function updateSignalFromOrderStatus(
  orderId: string,
  orderStatus: string
): Promise<void> {
  let signalStatus: SignalStatus;

  switch (orderStatus.toUpperCase()) {
    case "COMPLETE":
      signalStatus = "FILLED";
      break;
    case "REJECTED":
      signalStatus = "REJECTED";
      break;
    case "CANCELLED":
      signalStatus = "CANCELLED";
      break;
    default:
      return;
  }

  const { error } = await supabase
    .from("ai_signals")
    .update({
      signal_status: signalStatus,
      status_updated_at: new Date().toISOString(),
    })
    .eq("broker_order_id", orderId);

  if (error) {
    logger.error("Failed to update signal from order status", error);
  }
}

export async function expireOldSignals(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ai_signals")
    .update({
      signal_status: "EXPIRED",
      status_reason: "Signal expired after 24 hours",
      status_updated_at: new Date().toISOString(),
    })
    .in("signal_status", ["PENDING", "PENDING_EXECUTION"])
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    logger.error("Failed to expire old signals", error);
    return 0;
  }

  return data?.length || 0;
}
