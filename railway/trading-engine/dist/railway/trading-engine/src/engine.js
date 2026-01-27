"use strict";
/**
 * TRADING ENGINE - Railway Deployment
 * 24/7 persistent background AI auto-trading service
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./utils/supabase");
const logger_1 = require("./utils/logger");
const redis_1 = require("./utils/redis");
const shutdown_1 = require("./utils/shutdown");
const rate_limiter_1 = require("./rate-limiter");
const locks_1 = require("./utils/locks");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const executor_1 = require("./executor");
const signal_manager_1 = require("./signal-manager");
const evaluator_1 = require("./evaluator");
// NEW: Check if user's daily quota is already hit
async function checkDailyQuotaHit(userId) {
    const { data } = await supabase_1.supabase
        .from("trading_preferences")
        .select("daily_profit_limit, daily_loss_limit, daily_pnl_realized")
        .eq("user_id", userId)
        .single();
    if (!data)
        return { hit: false };
    const { daily_profit_limit, daily_loss_limit, daily_pnl_realized } = data;
    const realizedPnL = parseFloat(daily_pnl_realized) || 0;
    const profitLimit = parseFloat(daily_profit_limit) || 0;
    const lossLimit = parseFloat(daily_loss_limit) || 0;
    // Check profit target hit
    if (profitLimit > 0 && realizedPnL >= profitLimit) {
        return { hit: true, reason: `Daily profit target of ₹${profitLimit} reached` };
    }
    // Check loss limit hit
    if (lossLimit > 0 && realizedPnL <= -lossLimit) {
        return { hit: true, reason: `Daily loss limit of ₹${lossLimit} reached` };
    }
    return { hit: false };
}
// NEW: Auto-disable function when quota hit
async function autoDisableOnQuotaHit(userId, reason) {
    await supabase_1.supabase
        .from("trading_preferences")
        .update({
        auto_trading_enabled: false,
        daily_quota_hit_at: new Date().toISOString(),
        daily_quota_reason: reason,
        evaluation_error: reason,
        execution_lock: false,
    })
        .eq("user_id", userId);
    logger_1.logger.warn(`[QUOTA HIT] Auto-trading disabled for ${userId}: ${reason}`);
    // Log audit event - using standard supabase call since we don't have logAudit utility in engine
    await supabase_1.supabase.from("audit_logs").insert({
        user_id: userId,
        action: "trading_auto_disabled",
        target_table: "trading_preferences",
        metadata: { reason, triggered_by: "daily_quota_limit" },
    });
}
async function processUser(user) {
    const { user_id } = user;
    // FIRST: Check if daily quota already hit
    const quotaCheck = await checkDailyQuotaHit(user_id);
    if (quotaCheck.hit) {
        await autoDisableOnQuotaHit(user_id, quotaCheck.reason);
        return; // Skip this user entirely
    }
    const acquired = await (0, locks_1.acquireExecutionLock)(user_id);
    if (!acquired) {
        logger_1.logger.debug(`Could not acquire lock for user ${user_id}, skipping`);
        return;
    }
    let evaluationError = null;
    try {
        const rateLimited = await (0, rate_limiter_1.isRateLimited)(user_id);
        if (rateLimited) {
            logger_1.logger.debug(`User ${user_id} is rate limited, skipping`);
            return;
        }
        await (0, rate_limiter_1.incrementRateLimit)(user_id, "evaluation");
        let broker = null;
        if (!user.paper_trading_enabled) {
            broker = await (0, executor_1.getBrokerCredentials)(user_id);
            if (!broker || !broker.access_token) {
                evaluationError = "No valid broker token";
                return;
            }
            if ((0, executor_1.isTokenExpired)(broker.token_expires_at)) {
                evaluationError = "Broker token expired";
                await (0, executor_1.markTokenExpired)(user_id);
                return;
            }
        }
        if (!user.strategy_id) {
            evaluationError = "No strategy selected";
            return;
        }
        const strategy = await (0, evaluator_1.getStrategy)(user.strategy_id);
        if (!strategy) {
            evaluationError = "Strategy not found or inactive";
            return;
        }
        const instruments = strategy.instruments.length > 0
            ? strategy.instruments
            : [256265];
        const candles = await (0, evaluator_1.getLatestCandles)(instruments, strategy.timeframe);
        if (candles.length === 0) {
            logger_1.logger.debug(`No candle data for user ${user_id}`);
            return;
        }
        // NEW: Check Aira Brain Volatility Health
        const { data: heartbeat } = await supabase_1.supabase
            .from("brain_heartbeats")
            .select("volatility_level")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (heartbeat && heartbeat.volatility_level === 'extreme') {
            logger_1.logger.warn(`[HEALTH] Extreme volatility detected by Aira Brain. Blocking trades for ${user_id}`);
            return;
        }
        const signal = await (0, evaluator_1.evaluateWithAI)(strategy, candles, {
            risk_per_trade: user.risk_per_trade || 1,
            max_daily_loss: user.max_daily_loss || 1000,
            user_id: user_id,
            capital_used: user.daily_pnl_realized || 0 // Use PnL as a proxy for capital state if needed
        });
        if (signal && signal.action !== "HOLD") {
            const signalId = await (0, signal_manager_1.createSignal)(user_id, strategy.id, signal, "PENDING");
            const orderRateLimited = await (0, rate_limiter_1.isOrderRateLimited)(user_id);
            if (orderRateLimited) {
                await (0, signal_manager_1.updateSignalStatus)(signalId, "PENDING_EXECUTION", "Rate limited, will execute in next window");
                logger_1.logger.info(`User ${user_id} order rate limited, signal queued`);
                return;
            }
            const killSwitch = await (0, evaluator_1.checkKillSwitches)(user_id, {
                max_daily_loss: user.max_daily_loss || 1000,
                max_trades_per_day: user.max_trades_per_day || 10,
            });
            if (killSwitch.triggered) {
                await (0, signal_manager_1.updateSignalStatus)(signalId, "CANCELLED", `Kill switch: ${killSwitch.reason}`);
                evaluationError = `Kill switch: ${killSwitch.reason}`;
                return;
            }
            await (0, signal_manager_1.updateSignalStatus)(signalId, "EXECUTING", "Placing order");
            try {
                let orderResult;
                const config = {
                    user_id,
                    risk_per_trade: user.risk_per_trade || 1,
                    max_daily_loss: user.max_daily_loss || 1000,
                    max_trades_per_day: user.max_trades_per_day || 10,
                };
                if (user.paper_trading_enabled) {
                    orderResult = await (0, executor_1.executePaperOrder)(user_id, signal, config, strategy.id);
                }
                else if (broker) {
                    orderResult = await (0, executor_1.executeOrder)(user_id, broker, signal, config, strategy.id);
                }
                else {
                    throw new Error("No broker credentials for live trade");
                }
                await (0, signal_manager_1.updateSignalStatus)(signalId, "EXECUTED", `Order ID: ${orderResult.order_id}`, orderResult.order_id);
                await (0, rate_limiter_1.incrementRateLimit)(user_id, "order");
                logger_1.logger.info(`${user.paper_trading_enabled ? 'Paper' : 'Live'} trade executed for user ${user_id}: ${orderResult.order_id}`);
            }
            catch (execError) {
                const errorMsg = execError instanceof Error ? execError.message : "Unknown error";
                await (0, signal_manager_1.updateSignalStatus)(signalId, "FAILED", errorMsg);
                throw execError;
            }
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        logger_1.logger.error(`Error processing user ${user_id}: ${errorMsg}`);
        evaluationError = errorMsg;
    }
    finally {
        const nextEvaluation = (0, locks_1.calculateNextEvaluation)(user.strategy_type || "intraday");
        await (0, locks_1.releaseExecutionLock)(user_id, nextEvaluation, evaluationError || undefined);
    }
}
async function evaluationLoop() {
    logger_1.logger.info("Starting evaluation loop...");
    while (!(0, shutdown_1.getShutdownFlag)()) {
        try {
            const { data: users, error } = await supabase_1.supabase
                .from("trading_preferences")
                .select(`
          user_id,
          strategy_id,
          strategy_type,
          risk_per_trade:max_allocation_per_trade,
          max_daily_loss:daily_loss_limit,
          max_trades_per_day:daily_profit_limit,
          priority_score,
          paper_trading_enabled
        `)
                .eq("auto_trading_enabled", true)
                .eq("execution_lock", false)
                .lte("next_evaluation_at", new Date().toISOString())
                .lt("consecutive_failures", 5)
                .order("priority_score", { ascending: false })
                .order("next_evaluation_at", { ascending: true })
                .limit(10);
            if (error)
                throw error;
            for (const user of users || []) {
                if ((0, shutdown_1.getShutdownFlag)())
                    break;
                await processUser(user);
            }
            await sleep(5000);
        }
        catch (error) {
            logger_1.logger.error("Main loop error", error);
            await sleep(10000);
        }
    }
}
async function tokenRefreshLoop() {
    logger_1.logger.info("Starting token refresh loop...");
    while (!(0, shutdown_1.getShutdownFlag)()) {
        try {
            const now = new Date().toISOString();
            const { data: expiredUsers } = await supabase_1.supabase
                .from("user_broker_accounts")
                .select("user_id")
                .lt("token_expires_at", now)
                .eq("is_active", true);
            for (const user of expiredUsers || []) {
                await (0, locks_1.disableAutoTrading)(user.user_id, "Broker token expired");
            }
            await sleep(5 * 60 * 1000);
        }
        catch (error) {
            logger_1.logger.error("Token refresh loop error", error);
            await sleep(60 * 1000);
        }
    }
}
async function orderSyncLoop() {
    logger_1.logger.info("Starting order sync loop...");
    while (!(0, shutdown_1.getShutdownFlag)()) {
        try {
            const { data: openOrders } = await supabase_1.supabase
                .from("user_orders")
                .select("id, user_id, order_id, status")
                .in("status", ["placed", "open", "trigger_pending"])
                .limit(50);
            const userOrders = new Map();
            for (const order of openOrders || []) {
                if (!userOrders.has(order.user_id)) {
                    userOrders.set(order.user_id, []);
                }
                userOrders.get(order.user_id).push(order);
            }
            for (const [userId, orders] of userOrders) {
                if ((0, shutdown_1.getShutdownFlag)())
                    break;
                const broker = await (0, executor_1.getBrokerCredentials)(userId);
                if (!broker)
                    continue;
                for (const order of orders) {
                    try {
                        const latestStatus = await (0, executor_1.fetchOrderStatus)(broker, order.order_id);
                        if (latestStatus !== order.status && latestStatus !== "UNKNOWN") {
                            await supabase_1.supabase
                                .from("user_orders")
                                .update({
                                status: latestStatus.toLowerCase(),
                                updated_at: new Date().toISOString(),
                            })
                                .eq("id", order.id);
                            await (0, signal_manager_1.updateSignalFromOrderStatus)(order.order_id, latestStatus);
                        }
                    }
                    catch (err) {
                        logger_1.logger.error(`Failed to sync order ${order.order_id}`, err);
                    }
                }
            }
            await sleep(1000); // 1 second for faster order sync
        }
        catch (error) {
            logger_1.logger.error("Order sync loop error", error);
            await sleep(5000);
        }
    }
}
async function monitorPositions(tableName) {
    const { data: positions } = await supabase_1.supabase
        .from(tableName)
        .select(`
        id, user_id, instrument_token, tradingsymbol, quantity,
        entry_price, stop_loss, target_price, position_type
      `)
        .eq("status", "OPEN")
        .limit(100);
    for (const position of positions || []) {
        if ((0, shutdown_1.getShutdownFlag)())
            break;
        // Redis-First Price Fetch
        let currentPrice = null;
        try {
            const cachedTick = await redis_1.redis.get(redis_1.REDIS_KEYS.LATEST_TICK(position.instrument_token));
            if (cachedTick) {
                const parsed = JSON.parse(cachedTick);
                currentPrice = parsed.price;
                logger_1.logger.debug(`[Redis] Using cached price for ${position.tradingsymbol}: ${currentPrice}`);
            }
        }
        catch (err) {
            logger_1.logger.error(`[Redis] Error fetching price for ${position.instrument_token}`, err);
        }
        // Supabase Fallback
        if (currentPrice === null) {
            const { data: tick } = await supabase_1.supabase
                .from("realtime_ticks")
                .select("last_price")
                .eq("instrument_token", position.instrument_token)
                .order("tick_timestamp", { ascending: false })
                .limit(1)
                .single();
            if (tick) {
                currentPrice = tick.last_price;
                logger_1.logger.debug(`[Supabase] Using DB price for ${position.tradingsymbol}: ${currentPrice}`);
            }
        }
        if (currentPrice === null)
            continue;
        // NEW: Trailing Stop Loss Logic
        let stopLoss = position.stop_loss;
        const trailingSlPct = 0.5; // Example: 0.5% trailing SL
        if (position.position_type === "LONG") {
            const potentialNewSl = currentPrice * (1 - trailingSlPct / 100);
            if (potentialNewSl > stopLoss) {
                stopLoss = potentialNewSl;
                await supabase_1.supabase.from(tableName).update({ stop_loss: stopLoss }).eq("id", position.id);
                logger_1.logger.info(`[TRAILING SL] Updated LONG SL for ${position.tradingsymbol} to ${stopLoss.toFixed(2)}`);
            }
        }
        else {
            const potentialNewSl = currentPrice * (1 + trailingSlPct / 100);
            if (potentialNewSl < stopLoss) {
                stopLoss = potentialNewSl;
                await supabase_1.supabase.from(tableName).update({ stop_loss: stopLoss }).eq("id", position.id);
                logger_1.logger.info(`[TRAILING SL] Updated SHORT SL for ${position.tradingsymbol} to ${stopLoss.toFixed(2)}`);
            }
        }
        const pnl = position.position_type === "LONG"
            ? (currentPrice - position.entry_price) * position.quantity
            : (position.entry_price - currentPrice) * position.quantity;
        const pnlPercent = (pnl / (position.entry_price * position.quantity)) * 100;
        await supabase_1.supabase
            .from(tableName)
            .update({
            current_price: currentPrice,
            unrealized_pnl: pnl,
            unrealized_pnl_percent: pnlPercent,
            updated_at: new Date().toISOString(),
        })
            .eq("id", position.id);
        let exitReason = null;
        if (position.position_type === "LONG") {
            if (currentPrice <= position.stop_loss)
                exitReason = "STOP_LOSS_HIT";
            else if (currentPrice >= position.target_price)
                exitReason = "TARGET_HIT";
        }
        else {
            if (currentPrice >= position.stop_loss)
                exitReason = "STOP_LOSS_HIT";
            else if (currentPrice <= position.target_price)
                exitReason = "TARGET_HIT";
        }
        if (exitReason) {
            if (tableName === "user_positions") {
                try {
                    const broker = await (0, executor_1.getBrokerCredentials)(position.user_id);
                    if (broker) {
                        const closeResult = await (0, executor_1.closePosition)(position.user_id, broker, {
                            tradingsymbol: position.tradingsymbol,
                            quantity: position.quantity,
                            position_type: position.position_type,
                        }, exitReason);
                        if (!closeResult.success) {
                            logger_1.logger.error(`[LIVE] Failed to execute broker exit for ${position.id}: ${closeResult.error}`);
                            continue;
                        }
                        // Update ai_signals for P&L tracking
                        const { data: latestSignal } = await supabase_1.supabase
                            .from("ai_signals")
                            .select("id")
                            .eq("user_id", position.user_id)
                            .eq("tradingsymbol", position.tradingsymbol)
                            .eq("signal_status", "EXECUTED")
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .single();
                        if (latestSignal) {
                            await supabase_1.supabase.from("ai_signals").update({
                                exit_price: currentPrice,
                                exit_at: new Date().toISOString(),
                                pnl: pnl,
                                signal_status: "CLOSED",
                                status_reason: exitReason
                            }).eq("id", latestSignal.id);
                        }
                    }
                    else {
                        logger_1.logger.error(`[LIVE] No broker credentials to close position ${position.id}`);
                        continue;
                    }
                }
                catch (err) {
                    logger_1.logger.error(`[LIVE] Error during position exit for ${position.id}`, err);
                    continue;
                }
            }
            else {
                // Paper Trade History
                await supabase_1.supabase.from("paper_trade_history").insert({
                    user_id: position.user_id,
                    strategy_id: position.strategy_id,
                    instrument_token: position.instrument_token,
                    tradingsymbol: position.tradingsymbol,
                    transaction_type: position.position_type === "LONG" ? "SELL" : "BUY",
                    quantity: position.quantity,
                    entry_price: position.entry_price,
                    exit_price: currentPrice,
                    pnl: pnl,
                    pnl_percent: pnlPercent,
                    entry_at: position.created_at,
                    exit_at: new Date().toISOString(),
                    exit_reason: exitReason
                });
            }
            await supabase_1.supabase
                .from(tableName)
                .update({
                status: "CLOSED",
                exit_price: currentPrice,
                exit_reason: exitReason,
                closed_at: new Date().toISOString(),
            })
                .eq("id", position.id);
            // NEW: Update daily PnL and check quota
            await supabase_1.supabase.rpc("increment_daily_pnl", {
                user_id_val: position.user_id,
                pnl_val: pnl,
            });
            const quotaCheck = await checkDailyQuotaHit(position.user_id);
            if (quotaCheck.hit) {
                await autoDisableOnQuotaHit(position.user_id, quotaCheck.reason);
            }
            logger_1.logger.info(`[${tableName === 'paper_positions' ? 'PAPER' : 'LIVE'}] Position ${position.id} closed: ${exitReason} | P&L: ${pnl.toFixed(2)}`);
        }
    }
}
async function positionMonitorLoop() {
    logger_1.logger.info("Starting position monitor loop...");
    while (!(0, shutdown_1.getShutdownFlag)()) {
        try {
            await monitorPositions("user_positions");
            await monitorPositions("paper_positions");
            await sleep(1000); // 1 second for faster position monitoring
        }
        catch (error) {
            logger_1.logger.error("Position monitor loop error", error);
            await sleep(5000);
        }
    }
}
async function priorityUpdateLoop() {
    logger_1.logger.info("Starting priority update loop...");
    while (!(0, shutdown_1.getShutdownFlag)()) {
        try {
            await supabase_1.supabase.from("trading_preferences").update({ priority_score: 0 });
            const { data: livePos } = await supabase_1.supabase.from("user_positions").select("user_id").eq("status", "OPEN");
            const { data: paperPos } = await supabase_1.supabase.from("paper_positions").select("user_id").eq("status", "OPEN");
            const userIds = [...new Set([
                    ...(livePos || []).map((u) => u.user_id),
                    ...(paperPos || []).map((u) => u.user_id)
                ])];
            if (userIds.length > 0) {
                for (const userId of userIds) {
                    await supabase_1.supabase
                        .from("trading_preferences")
                        .update({ priority_score: 100 })
                        .eq("user_id", userId);
                }
            }
            const { data: liveUrgent } = await supabase_1.supabase
                .from("user_positions")
                .select("user_id")
                .eq("status", "OPEN")
                .lt("unrealized_pnl_percent", -2);
            const { data: paperUrgent } = await supabase_1.supabase
                .from("paper_positions")
                .select("user_id")
                .eq("status", "OPEN")
                .lt("unrealized_pnl_percent", -2);
            const urgentUserIds = [...new Set([
                    ...(liveUrgent || []).map((u) => u.user_id),
                    ...(paperUrgent || []).map((u) => u.user_id)
                ])];
            if (urgentUserIds.length > 0) {
                for (const userId of urgentUserIds) {
                    await supabase_1.supabase
                        .from("trading_preferences")
                        .update({ priority_score: 200 })
                        .eq("user_id", userId);
                }
            }
            logger_1.logger.debug(`Updated priorities: ${userIds.length} with positions, ${urgentUserIds.length} urgent`);
            await sleep(30 * 1000);
        }
        catch (error) {
            logger_1.logger.error("Priority update loop error", error);
            await sleep(60 * 1000);
        }
    }
}
async function cleanupLoop() {
    logger_1.logger.info("Starting cleanup loop...");
    while (!(0, shutdown_1.getShutdownFlag)()) {
        try {
            const released = await (0, locks_1.releaseStaleLocks)();
            if (released > 0) {
                logger_1.logger.info(`Released ${released} stale locks`);
            }
            const expired = await (0, signal_manager_1.expireOldSignals)();
            if (expired > 0) {
                logger_1.logger.info(`Expired ${expired} old signals`);
            }
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            await supabase_1.supabase.from("user_rate_limits").delete().lt("minute_window", oneHourAgo);
            await supabase_1.supabase
                .from("trading_preferences")
                .update({ consecutive_failures: 0 })
                .gt("consecutive_failures", 0)
                .lt("last_evaluation_at", oneHourAgo);
            await sleep(60 * 60 * 1000);
        }
        catch (error) {
            logger_1.logger.error("Cleanup loop error", error);
            await sleep(10 * 60 * 1000);
        }
    }
}
async function processScannerUser(user) {
    const { user_id, strategy_id } = user;
    try {
        if (!strategy_id)
            return;
        const strategy = await (0, evaluator_1.getStrategy)(strategy_id);
        if (!strategy)
            return;
        const instruments = strategy.instruments.length > 0
            ? strategy.instruments
            : [256265]; // NIFTY 50 default
        const candles = await (0, evaluator_1.getLatestCandles)(instruments, strategy.timeframe);
        if (candles.length === 0)
            return;
        const signal = await (0, evaluator_1.evaluateWithAI)(strategy, candles, {
            risk_per_trade: user.risk_per_trade || 1,
            max_daily_loss: user.max_daily_loss || 1000,
            user_id: user_id,
            capital_used: 0
        });
        if (signal && signal.action !== "HOLD") {
            // Check for duplicate signals in last 5 minutes
            const { data: existing } = await supabase_1.supabase
                .from("ai_signals")
                .select("id")
                .eq("user_id", user_id)
                .eq("strategy_id", strategy_id)
                .eq("tradingsymbol", signal.instrument)
                .eq("signal_type", "SCANNER")
                .gt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
                .limit(1);
            if (existing && existing.length > 0) {
                logger_1.logger.debug(`Duplicate scanner signal for ${user_id} on ${signal.instrument}, skipping`);
                return;
            }
            await (0, signal_manager_1.createSignal)(user_id, strategy.id, signal, "PENDING", "SCANNER");
            logger_1.logger.info(`[SCANNER] New signal for ${user_id}: ${signal.action} ${signal.instrument}`);
        }
    }
    catch (error) {
        logger_1.logger.error(`Error in processScannerUser for ${user_id}:`, error);
    }
}
async function scannerLoop() {
    logger_1.logger.info("Starting scanner loop...");
    while (!(0, shutdown_1.getShutdownFlag)()) {
        try {
            const { data: users, error } = await supabase_1.supabase
                .from("trading_preferences")
                .select(`
          user_id,
          strategy_id,
          strategy_type,
          is_scanner_active
        `)
                .eq("is_scanner_active", true)
                .limit(20);
            if (error)
                throw error;
            for (const user of users || []) {
                if ((0, shutdown_1.getShutdownFlag)())
                    break;
                await processScannerUser(user);
            }
            await sleep(15000); // Scan every 15 seconds
        }
        catch (error) {
            logger_1.logger.error("Scanner loop error", error);
            await sleep(30000);
        }
    }
}
async function updateEngineStatus(status, errorMessage) {
    const { data: activeUsers } = await supabase_1.supabase
        .from("trading_preferences")
        .select("user_id")
        .eq("auto_trading_enabled", true);
    await supabase_1.supabase.from("trading_engine_status").upsert({
        engine_type: "trading_engine",
        status,
        last_heartbeat: new Date().toISOString(),
        active_users: activeUsers?.length || 0,
        error_message: errorMessage || null,
        started_at: status === "running" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });
}
async function cleanup() {
    logger_1.logger.info("Running cleanup...");
    await updateEngineStatus("stopped");
}
async function autoSquareOffLoop() {
    logger_1.logger.info("Starting auto-squareoff loop...");
    while (!(0, shutdown_1.getShutdownFlag)()) {
        try {
            const now = new Date();
            const currentHour = now.getUTCHours();
            const currentMinute = now.getUTCMinutes();
            // 3:15 PM IST = 9:45 AM UTC
            // Run between 9:45 AM UTC and 10:00 AM UTC
            if (currentHour === 9 && currentMinute >= 45 && currentMinute < 60) {
                logger_1.logger.info("[SQUAREOFF] Starting end-of-day squareoff...");
                // Square off Live Positions
                const { data: livePositions } = await supabase_1.supabase
                    .from("user_positions")
                    .select("*")
                    .eq("status", "OPEN");
                for (const pos of livePositions || []) {
                    const broker = await (0, executor_1.getBrokerCredentials)(pos.user_id);
                    if (broker) {
                        await (0, executor_1.closePosition)(pos.user_id, broker, {
                            tradingsymbol: pos.tradingsymbol,
                            quantity: pos.quantity,
                            position_type: pos.position_type
                        }, "AUTO_SQUAREOFF");
                    }
                    await supabase_1.supabase.from("user_positions").update({
                        status: "CLOSED",
                        exit_reason: "AUTO_SQUAREOFF",
                        closed_at: new Date().toISOString()
                    }).eq("id", pos.id);
                }
                // Square off Paper Positions
                await supabase_1.supabase
                    .from("paper_positions")
                    .update({
                    status: "CLOSED",
                    exit_reason: "AUTO_SQUAREOFF",
                    closed_at: new Date().toISOString()
                })
                    .eq("status", "OPEN");
                logger_1.logger.info("[SQUAREOFF] End-of-day squareoff completed");
                // Wait for 15 minutes to avoid re-triggering in the same window
                await sleep(15 * 60 * 1000);
            }
            await sleep(60000); // Check every minute
        }
        catch (error) {
            logger_1.logger.error("Auto-squareoff loop error", error);
            await sleep(60000);
        }
    }
}
async function main() {
    logger_1.logger.info("Trading Engine starting...");
    (0, shutdown_1.setupGracefulShutdown)(cleanup);
    const released = await (0, locks_1.releaseStaleLocks)();
    logger_1.logger.info(`Released ${released} stale locks from previous session`);
    await updateEngineStatus("running");
    // NEW: Heartbeat loop for trading engine
    const heartbeatInterval = setInterval(async () => {
        if ((0, shutdown_1.getShutdownFlag)()) {
            clearInterval(heartbeatInterval);
            return;
        }
        try {
            await updateEngineStatus("running");
        }
        catch (err) {
            logger_1.logger.error("Heartbeat error", err);
        }
    }, 30000);
    await Promise.all([
        evaluationLoop(),
        scannerLoop(),
        tokenRefreshLoop(),
        orderSyncLoop(),
        positionMonitorLoop(),
        priorityUpdateLoop(),
        cleanupLoop(),
        autoSquareOffLoop(),
    ]);
}
main().catch((err) => {
    logger_1.logger.error("Fatal error", err);
    process.exit(1);
});
//# sourceMappingURL=engine.js.map