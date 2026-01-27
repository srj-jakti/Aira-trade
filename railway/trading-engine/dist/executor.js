"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrokerCredentials = getBrokerCredentials;
exports.isTokenExpired = isTokenExpired;
exports.markTokenExpired = markTokenExpired;
exports.closePosition = closePosition;
exports.executePaperOrder = executePaperOrder;
exports.executeOrder = executeOrder;
exports.fetchOrderStatus = fetchOrderStatus;
const supabase_1 = require("./utils/supabase");
const logger_1 = require("./utils/logger");
const crypto_1 = require("crypto");
const redis_1 = require("./utils/redis");
const ALGORITHM = "aes-256-gcm";
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];
const MAX_SLIPPAGE_PCT = 0.5; // 0.5% max slippage from signal price
/**
 * Validates if the current market price is still "ok to take"
 */
async function validatePriceHealth(signal) {
    try {
        // Get latest tick from Redis for minimum latency
        const cachedTick = await redis_1.redis.get(redis_1.REDIS_KEYS.LATEST_TICK(signal.instrumentToken));
        if (!cachedTick)
            return { ok: true }; // Fallback to signal price if no tick available
        const tick = JSON.parse(cachedTick);
        const currentPrice = tick.price || tick.last_price;
        if (!currentPrice)
            return { ok: true };
        const slippage = Math.abs((currentPrice - signal.price) / signal.price) * 100;
        // Check if price has moved too far in favor or against (avoiding chasing)
        if (slippage > MAX_SLIPPAGE_PCT) {
            return {
                ok: false,
                currentPrice,
                reason: `Price moved too far from signal (${slippage.toFixed(2)}% slippage)`
            };
        }
        // Expert rule: Don't buy if price is already above target or sell if below
        if (signal.action === "BUY" && currentPrice >= signal.target)
            return { ok: false, reason: "Target already reached" };
        if (signal.action === "SELL" && currentPrice <= signal.target)
            return { ok: false, reason: "Target already reached" };
        // Expert rule: Don't enter if price is too close to Stop Loss (R:R degraded)
        const risk = Math.abs(currentPrice - signal.stopLoss);
        const reward = Math.abs(signal.target - currentPrice);
        if (reward / risk < 1.1)
            return { ok: false, reason: "Risk/Reward ratio degraded (too close to SL)" };
        return { ok: true, currentPrice };
    }
    catch (err) {
        logger_1.logger.error("Price health check failed", err);
        return { ok: true };
    }
}
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
    }
    return Buffer.from(key, "hex");
}
function decrypt(ciphertext) {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
    if (!ivHex || !authTagHex || !encrypted) {
        throw new Error("Invalid encrypted format");
    }
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isNetworkError(error) {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return (msg.includes("econnreset") ||
            msg.includes("econnrefused") ||
            msg.includes("etimedout") ||
            msg.includes("network") ||
            msg.includes("socket"));
    }
    return false;
}
function isTimeoutError(error) {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return msg.includes("timeout") || msg.includes("timed out");
    }
    return false;
}
async function getBrokerCredentials(userId) {
    const { data } = await supabase_1.supabase
        .from("user_broker_accounts")
        .select("id, user_id, api_key, access_token, token_expires_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("is_connected", true)
        .single();
    if (!data || !data.access_token)
        return null;
    return {
        id: data.id,
        user_id: data.user_id,
        api_key: decrypt(data.api_key),
        access_token: decrypt(data.access_token),
        token_expires_at: data.token_expires_at,
    };
}
function isTokenExpired(tokenExpiry) {
    if (!tokenExpiry)
        return true;
    return new Date(tokenExpiry) < new Date();
}
async function markTokenExpired(userId) {
    await supabase_1.supabase
        .from("user_broker_accounts")
        .update({ is_connected: false })
        .eq("user_id", userId);
}
function calculateQuantity(signal, config) {
    const capital = config.capital || 100000;
    const riskAmount = capital * (config.risk_per_trade / 100);
    const stopLossPoints = Math.abs(signal.price - signal.stopLoss);
    if (stopLossPoints === 0)
        return 1;
    const quantity = Math.floor(riskAmount / stopLossPoints);
    return Math.max(1, quantity);
}
async function logOrder(userId, signal, result, brokerAccountId, strategyId) {
    await supabase_1.supabase.from("user_orders").insert({
        user_id: userId,
        broker_account_id: brokerAccountId,
        strategy_id: strategyId,
        order_id: result.order_id,
        tradingsymbol: signal.instrument,
        exchange: "NSE",
        transaction_type: signal.action,
        order_type: "MARKET",
        product: "MIS",
        quantity: 1,
        status: result.success ? "placed" : "error",
        status_message: result.error,
        placed_at: new Date().toISOString(),
    });
}
async function logPaperOrder(userId, signal, result, strategyId) {
    const quantity = signal.quantity || 1;
    await supabase_1.supabase.from("paper_orders").insert({
        user_id: userId,
        strategy_id: strategyId,
        order_id: result.order_id,
        tradingsymbol: signal.instrument,
        exchange: "NSE",
        transaction_type: signal.action,
        order_type: "MARKET",
        product: "MIS",
        quantity: quantity,
        status: result.success ? "placed" : "error",
        status_message: result.error,
        placed_at: new Date().toISOString(),
        filled_at: result.success ? new Date().toISOString() : null,
        fill_price: result.success ? signal.price : null,
    });
    if (result.success && signal.action !== "HOLD") {
        // Also create/update paper position
        const { data: existingPos } = await supabase_1.supabase
            .from("paper_positions")
            .select("*")
            .eq("user_id", userId)
            .eq("instrument_token", signal.instrumentToken)
            .eq("status", "OPEN")
            .single();
        if (existingPos) {
            // Handle closing or increasing? For now simple one position per instrument
            // If it's reverse action, close it
            if (existingPos.position_type !== (signal.action === "BUY" ? "LONG" : "SHORT")) {
                await supabase_1.supabase.from("paper_positions").update({
                    status: "CLOSED",
                    exit_price: signal.price,
                    exit_reason: "SIGNAL_REVERSAL",
                    closed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }).eq("id", existingPos.id);
            }
        }
        else {
            const quantity = signal.quantity || 1;
            await supabase_1.supabase.from("paper_positions").insert({
                user_id: userId,
                strategy_id: strategyId,
                instrument_token: signal.instrumentToken,
                tradingsymbol: signal.instrument,
                quantity: quantity,
                entry_price: signal.price,
                stop_loss: signal.stopLoss,
                target_price: signal.target,
                status: "OPEN",
                position_type: signal.action === "BUY" ? "LONG" : "SHORT"
            });
        }
    }
}
async function logOrderError(userId, signal, error, brokerAccountId) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await supabase_1.supabase.from("user_orders").insert({
        user_id: userId,
        broker_account_id: brokerAccountId,
        tradingsymbol: signal.instrument,
        exchange: "NSE",
        transaction_type: signal.action,
        order_type: "MARKET",
        product: "MIS",
        quantity: 1, // We should ideally log the intended quantity if available
        status: "error",
        status_message: errorMsg,
    });
}
async function closePosition(userId, broker, position, reason) {
    try {
        const transactionType = position.position_type === "LONG" ? "SELL" : "BUY";
        const orderParams = {
            tradingsymbol: position.tradingsymbol,
            exchange: "NSE",
            transaction_type: transactionType,
            order_type: "MARKET",
            product: "MIS",
            quantity: position.quantity.toString(),
            validity: "DAY",
            tag: "AIRA_EXIT",
        };
        const response = await fetch("https://api.kite.trade/orders/regular", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Kite-Version": "3",
                Authorization: `token ${broker.api_key}:${broker.access_token}`,
            },
            body: new URLSearchParams(orderParams),
        });
        const data = await response.json();
        const orderId = data.data?.order_id;
        const success = response.ok && !!orderId;
        const result = {
            success,
            order_id: orderId,
            status: success ? "placed" : "rejected",
            error: success ? undefined : data.message || "Close order failed",
        };
        // Log this as a closing order
        await supabase_1.supabase.from("user_orders").insert({
            user_id: userId,
            broker_account_id: broker.id,
            order_id: result.order_id,
            tradingsymbol: position.tradingsymbol,
            exchange: "NSE",
            transaction_type: transactionType,
            order_type: "MARKET",
            product: "MIS",
            quantity: position.quantity,
            status: result.success ? "placed" : "error",
            status_message: result.error || `Exit reason: ${reason}`,
            placed_at: new Date().toISOString(),
        });
        return result;
    }
    catch (error) {
        logger_1.logger.error(`Failed to close position for user ${userId}`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
async function executePaperOrder(userId, signal, config, strategyId) {
    // Expert Price Health Check
    const health = await validatePriceHealth(signal);
    if (!health.ok) {
        logger_1.logger.info(`[PAPER] Order for user ${userId} blocked by Expert Price Health: ${health.reason}`);
        return { success: false, error: `Expert Filter: ${health.reason}` };
    }
    const fillPrice = health.currentPrice || signal.price;
    const quantity = calculateQuantity(signal, config);
    const orderId = `PAPER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const result = {
        success: true,
        order_id: orderId,
        status: "complete",
    };
    // Use fillPrice for the paper order log
    await logPaperOrder(userId, { ...signal, price: fillPrice }, result, strategyId);
    return result;
}
async function executeOrder(userId, broker, signal, config, strategyId) {
    // Expert Price Health Check
    const health = await validatePriceHealth(signal);
    if (!health.ok) {
        logger_1.logger.info(`[LIVE] Order for user ${userId} blocked by Expert Price Health: ${health.reason}`);
        return { success: false, error: `Expert Filter: ${health.reason}` };
    }
    const quantity = calculateQuantity(signal, config);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const orderParams = {
                tradingsymbol: signal.instrument,
                exchange: "NSE",
                transaction_type: signal.action,
                order_type: "MARKET",
                product: "MIS",
                quantity: quantity.toString(),
                validity: "DAY",
                tag: "AIRA_AUTO",
            };
            const response = await fetch("https://api.kite.trade/orders/regular", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Kite-Version": "3",
                    Authorization: `token ${broker.api_key}:${broker.access_token}`,
                },
                body: new URLSearchParams(orderParams),
            });
            const data = await response.json();
            const orderId = data.data?.order_id;
            const success = response.ok && !!orderId;
            const result = {
                success,
                order_id: orderId,
                status: success ? "placed" : "rejected",
                error: success ? undefined : data.message || "Order failed",
            };
            await logOrder(userId, signal, result, broker.id, strategyId);
            if (!success) {
                logger_1.logger.error(`Order rejected for user ${userId}: ${data.message}`);
            }
            else {
                logger_1.logger.info(`Order placed for user ${userId}: ${orderId}`);
            }
            return result;
        }
        catch (error) {
            const isRetryable = isNetworkError(error) || isTimeoutError(error);
            if (!isRetryable) {
                logger_1.logger.error(`Non-retryable error for user ${userId}`, error);
                await logOrderError(userId, signal, error, broker.id);
                throw error;
            }
            if (attempt < MAX_RETRIES - 1) {
                logger_1.logger.warn(`Retry ${attempt + 1} for user ${userId} in ${RETRY_DELAYS[attempt]}ms`);
                await sleep(RETRY_DELAYS[attempt]);
            }
        }
    }
    const error = new Error(`Failed to execute order after ${MAX_RETRIES} attempts`);
    await logOrderError(userId, signal, error, broker.id);
    throw error;
}
async function fetchOrderStatus(broker, orderId) {
    try {
        const response = await fetch(`https://api.kite.trade/orders/${orderId}`, {
            headers: {
                "X-Kite-Version": "3",
                Authorization: `token ${broker.api_key}:${broker.access_token}`,
            },
        });
        const data = await response.json();
        const orders = data.data || [];
        if (orders.length > 0) {
            return orders[orders.length - 1].status || "UNKNOWN";
        }
        return "UNKNOWN";
    }
    catch (error) {
        logger_1.logger.error("Failed to fetch order status", error);
        return "UNKNOWN";
    }
}
//# sourceMappingURL=executor.js.map