"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSignal = createSignal;
exports.updateSignalStatus = updateSignalStatus;
exports.updateSignalFromOrderStatus = updateSignalFromOrderStatus;
exports.expireOldSignals = expireOldSignals;
const supabase_1 = require("./utils/supabase");
const logger_1 = require("./utils/logger");
async function createSignal(userId, strategyId, signal, status, signalType = "TRADING") {
    const { data, error } = await supabase_1.supabase
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
        logger_1.logger.error("Failed to create signal", error);
        throw error;
    }
    return data.id;
}
async function updateSignalStatus(signalId, status, reason, orderId) {
    const update = {
        signal_status: status,
        status_reason: reason,
        status_updated_at: new Date().toISOString(),
    };
    if (orderId) {
        update.broker_order_id = orderId;
    }
    const { error } = await supabase_1.supabase
        .from("ai_signals")
        .update(update)
        .eq("id", signalId);
    if (error) {
        logger_1.logger.error("Failed to update signal status", error);
    }
}
async function updateSignalFromOrderStatus(orderId, orderStatus) {
    let signalStatus;
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
    const { error } = await supabase_1.supabase
        .from("ai_signals")
        .update({
        signal_status: signalStatus,
        status_updated_at: new Date().toISOString(),
    })
        .eq("broker_order_id", orderId);
    if (error) {
        logger_1.logger.error("Failed to update signal from order status", error);
    }
}
async function expireOldSignals() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase_1.supabase
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
        logger_1.logger.error("Failed to expire old signals", error);
        return 0;
    }
    return data?.length || 0;
}
//# sourceMappingURL=signal-manager.js.map