/**
 * TRADING ENGINE - Railway Deployment
 * 24/7 persistent background AI auto-trading service
 * 
 * This engine:
 * - Runs independently of browser/UI
 * - Evaluates strategies for all users with auto_trading_enabled
 * - Executes trades via Zerodha API
 * - Manages execution locks to prevent duplicate trades
 * - Handles token refresh, position monitoring, and cleanup
 */

import { supabase } from "./utils/supabase";
import { logger } from "./utils/logger";
import { setupGracefulShutdown, getShutdownFlag } from "./utils/shutdown";
import { isRateLimited, isOrderRateLimited, incrementRateLimit } from "./rate-limiter";
import {
  getBrokerCredentials,
  isTokenExpired,
  markTokenExpired,
  executeOrder,
  fetchOrderStatus,
} from "./executor";
import {
  createSignal,
  updateSignalStatus,
  updateSignalFromOrderStatus,
  expireOldSignals,
} from "./signal-manager";
import {
  getStrategy,
  getLatestCandles,
  evaluateWithAI,
  checkKillSwitches,
} from "./evaluator";

interface TradingPreference {
  user_id: string;
  strategy_id: string | null;
  strategy_type: string;
  risk_per_trade: number;
  max_daily_loss: number;
  max_trades_per_day: number;
  priority_score: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateNextEvaluation(strategyType: string): Date {
  const now = new Date();
  switch (strategyType) {
    case "scalping":
      return new Date(now.getTime() + 5 * 1000);
    case "intraday":
      return new Date(now.getTime() + 30 * 1000);
    case "swing":
      return new Date(now.getTime() + 5 * 60 * 1000);
    default:
      return new Date(now.getTime() + 30 * 1000);
  }
}

async function acquireExecutionLock(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("trading_preferences")
    .update({
      execution_lock: true,
      execution_started_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("execution_lock", false)
    .eq("auto_trading_enabled", true)
    .select("user_id");

  if (error) {
    logger.error("Failed to acquire lock", error);
    return false;
  }

  return (data?.length || 0) > 0;
}

async function releaseExecutionLock(
  userId: string,
  nextEvaluationAt: Date,
  error?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    execution_lock: false,
    execution_started_at: null,
    last_evaluation_at: new Date().toISOString(),
    next_evaluation_at: nextEvaluationAt.toISOString(),
    evaluation_error: error || null,
  };

  if (error) {
    const { data } = await supabase
      .from("trading_preferences")
      .select("consecutive_failures")
      .eq("user_id", userId)
      .single();
    update.consecutive_failures = ((data?.consecutive_failures || 0) + 1);
  } else {
    update.consecutive_failures = 0;
  }

  await supabase.from("trading_preferences").update(update).eq("user_id", userId);
}

async function releaseStaleLocks(): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("trading_preferences")
    .update({
      execution_lock: false,
      execution_started_at: null,
      evaluation_error: "Lock released due to timeout (possible crash)",
    })
    .eq("execution_lock", true)
    .lt("execution_started_at", fiveMinutesAgo)
    .select("user_id");

  if (error) {
    logger.error("Failed to release stale locks", error);
    return 0;
  }

  return data?.length || 0;
}

async function disableAutoTrading(userId: string, reason: string): Promise<void> {
  await supabase
    .from("trading_preferences")
    .update({
      auto_trading_enabled: false,
      evaluation_error: reason,
      execution_lock: false,
    })
    .eq("user_id", userId);

  logger.warn(`Disabled auto-trading for user ${userId}: ${reason}`);
}

async function processUser(user: TradingPreference): Promise<void> {
  const { user_id } = user;

  const acquired = await acquireExecutionLock(user_id);
  if (!acquired) {
    logger.debug(`Could not acquire lock for user ${user_id}, skipping`);
    return;
  }

  let evaluationError: string | null = null;

  try {
    const rateLimited = await isRateLimited(user_id);
    if (rateLimited) {
      logger.debug(`User ${user_id} is rate limited, skipping`);
      return;
    }

    await incrementRateLimit(user_id, "evaluation");

    const broker = await getBrokerCredentials(user_id);
    if (!broker || !broker.access_token) {
      evaluationError = "No valid broker token";
      return;
    }

    if (isTokenExpired(broker.token_expires_at)) {
      evaluationError = "Broker token expired";
      await markTokenExpired(user_id);
      return;
    }

    if (!user.strategy_id) {
      evaluationError = "No strategy selected";
      return;
    }

    const strategy = await getStrategy(user.strategy_id);
    if (!strategy) {
      evaluationError = "Strategy not found or inactive";
      return;
    }

    const instruments = strategy.instruments.length > 0 
      ? strategy.instruments 
      : [256265];

    const candles = await getLatestCandles(instruments, strategy.timeframe);

    if (candles.length === 0) {
      logger.debug(`No candle data for user ${user_id}`);
      return;
    }

    const signal = await evaluateWithAI(strategy, candles, {
      risk_per_trade: user.risk_per_trade || 1,
      max_daily_loss: user.max_daily_loss || 1000,
    });

    if (signal && signal.action !== "HOLD") {
      const signalId = await createSignal(user_id, strategy.id, signal, "PENDING");

      const orderRateLimited = await isOrderRateLimited(user_id);
      if (orderRateLimited) {
        await updateSignalStatus(
          signalId,
          "PENDING_EXECUTION",
          "Rate limited, will execute in next window"
        );
        logger.info(`User ${user_id} order rate limited, signal queued`);
        return;
      }

      const killSwitch = await checkKillSwitches(user_id, {
        max_daily_loss: user.max_daily_loss || 1000,
        max_trades_per_day: user.max_trades_per_day || 10,
      });

      if (killSwitch.triggered) {
        await updateSignalStatus(signalId, "CANCELLED", `Kill switch: ${killSwitch.reason}`);
        evaluationError = `Kill switch: ${killSwitch.reason}`;
        return;
      }

      await updateSignalStatus(signalId, "EXECUTING", "Placing order with broker");

      try {
        const orderResult = await executeOrder(
          user_id,
          broker,
          signal,
          {
            user_id,
            risk_per_trade: user.risk_per_trade || 1,
            max_daily_loss: user.max_daily_loss || 1000,
            max_trades_per_day: user.max_trades_per_day || 10,
          },
          strategy.id
        );

        await updateSignalStatus(
          signalId,
          "EXECUTED",
          `Order ID: ${orderResult.order_id}`,
          orderResult.order_id
        );

        await incrementRateLimit(user_id, "order");
        logger.info(`Trade executed for user ${user_id}: ${orderResult.order_id}`);
      } catch (execError) {
        const errorMsg = execError instanceof Error ? execError.message : "Unknown error";
        await updateSignalStatus(signalId, "FAILED", errorMsg);
        throw execError;
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Error processing user ${user_id}: ${errorMsg}`);
    evaluationError = errorMsg;
  } finally {
    const nextEvaluation = calculateNextEvaluation(user.strategy_type || "intraday");
    await releaseExecutionLock(user_id, nextEvaluation, evaluationError || undefined);
  }
}

async function evaluationLoop(): Promise<void> {
  logger.info("Starting evaluation loop...");

  while (!getShutdownFlag()) {
    try {
      const { data: users, error } = await supabase
        .from("trading_preferences")
        .select(`
          user_id,
          strategy_id,
          strategy_type,
          risk_per_trade:max_allocation_per_trade,
          max_daily_loss:daily_loss_limit,
          max_trades_per_day:daily_profit_limit,
          priority_score
        `)
        .eq("auto_trading_enabled", true)
        .eq("execution_lock", false)
        .lte("next_evaluation_at", new Date().toISOString())
        .lt("consecutive_failures", 5)
        .order("priority_score", { ascending: false })
        .order("next_evaluation_at", { ascending: true })
        .limit(10);

      if (error) throw error;

      for (const user of users || []) {
        if (getShutdownFlag()) break;
        await processUser(user as TradingPreference);
      }

      await sleep(5000);
    } catch (error) {
      logger.error("Main loop error", error);
      await sleep(10000);
    }
  }
}

async function tokenRefreshLoop(): Promise<void> {
  logger.info("Starting token refresh loop...");

  while (!getShutdownFlag()) {
    try {
      const now = new Date().toISOString();

      const { data: expiredUsers } = await supabase
        .from("user_broker_accounts")
        .select("user_id")
        .lt("token_expires_at", now)
        .eq("is_active", true);

      for (const user of expiredUsers || []) {
        await disableAutoTrading(user.user_id, "Broker token expired");
      }

      await sleep(5 * 60 * 1000);
    } catch (error) {
      logger.error("Token refresh loop error", error);
      await sleep(60 * 1000);
    }
  }
}

async function orderSyncLoop(): Promise<void> {
  logger.info("Starting order sync loop...");

  while (!getShutdownFlag()) {
    try {
      const { data: openOrders } = await supabase
        .from("user_orders")
        .select("id, user_id, order_id, status")
        .in("status", ["placed", "open", "trigger_pending"])
        .limit(50);

      const userOrders = new Map<string, Array<{ id: string; order_id: string; status: string }>>();
      for (const order of openOrders || []) {
        if (!userOrders.has(order.user_id)) {
          userOrders.set(order.user_id, []);
        }
        userOrders.get(order.user_id)!.push(order);
      }

      for (const [userId, orders] of userOrders) {
        if (getShutdownFlag()) break;

        const broker = await getBrokerCredentials(userId);
        if (!broker) continue;

        for (const order of orders) {
          try {
            const latestStatus = await fetchOrderStatus(broker, order.order_id);

            if (latestStatus !== order.status && latestStatus !== "UNKNOWN") {
              await supabase
                .from("user_orders")
                .update({
                  status: latestStatus.toLowerCase(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", order.id);

              await updateSignalFromOrderStatus(order.order_id, latestStatus);
            }
          } catch (err) {
            logger.error(`Failed to sync order ${order.order_id}`, err);
          }
        }
      }

      await sleep(30 * 1000);
    } catch (error) {
      logger.error("Order sync loop error", error);
      await sleep(60 * 1000);
    }
  }
}

async function positionMonitorLoop(): Promise<void> {
  logger.info("Starting position monitor loop...");

  while (!getShutdownFlag()) {
    try {
      const { data: positions } = await supabase
        .from("user_positions")
        .select(`
          id, user_id, instrument_token, tradingsymbol, quantity,
          entry_price, stop_loss, target_price, position_type
        `)
        .eq("status", "OPEN")
        .limit(100);

      for (const position of positions || []) {
        if (getShutdownFlag()) break;

        const { data: tick } = await supabase
          .from("realtime_ticks")
          .select("last_price")
          .eq("instrument_token", position.instrument_token)
          .order("tick_timestamp", { ascending: false })
          .limit(1)
          .single();

        if (!tick) continue;

        const currentPrice = tick.last_price;
        const pnl =
          position.position_type === "LONG"
            ? (currentPrice - position.entry_price) * position.quantity
            : (position.entry_price - currentPrice) * position.quantity;
        const pnlPercent = (pnl / (position.entry_price * position.quantity)) * 100;

        await supabase
          .from("user_positions")
          .update({
            current_price: currentPrice,
            unrealized_pnl: pnl,
            unrealized_pnl_percent: pnlPercent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", position.id);

        let exitReason: string | null = null;
        if (position.position_type === "LONG") {
          if (currentPrice <= position.stop_loss) exitReason = "STOP_LOSS_HIT";
          else if (currentPrice >= position.target_price) exitReason = "TARGET_HIT";
        } else {
          if (currentPrice >= position.stop_loss) exitReason = "STOP_LOSS_HIT";
          else if (currentPrice <= position.target_price) exitReason = "TARGET_HIT";
        }

        if (exitReason) {
          await supabase
            .from("user_positions")
            .update({
              status: "CLOSED",
              exit_price: currentPrice,
              exit_reason: exitReason,
              closed_at: new Date().toISOString(),
            })
            .eq("id", position.id);

          logger.info(`Position ${position.id} closed: ${exitReason}`);
        }
      }

      await sleep(10 * 1000);
    } catch (error) {
      logger.error("Position monitor loop error", error);
      await sleep(30 * 1000);
    }
  }
}

async function priorityUpdateLoop(): Promise<void> {
  logger.info("Starting priority update loop...");

  while (!getShutdownFlag()) {
    try {
      await supabase.from("trading_preferences").update({ priority_score: 0 });

      const { data: usersWithPositions } = await supabase
        .from("user_positions")
        .select("user_id")
        .eq("status", "OPEN");

      const userIds = [...new Set((usersWithPositions || []).map((u) => u.user_id))];

      if (userIds.length > 0) {
        for (const userId of userIds) {
          await supabase
            .from("trading_preferences")
            .update({ priority_score: 100 })
            .eq("user_id", userId);
        }
      }

      const { data: urgentPositions } = await supabase
        .from("user_positions")
        .select("user_id")
        .eq("status", "OPEN")
        .lt("unrealized_pnl_percent", -2);

      const urgentUserIds = [...new Set((urgentPositions || []).map((u) => u.user_id))];

      if (urgentUserIds.length > 0) {
        for (const userId of urgentUserIds) {
          await supabase
            .from("trading_preferences")
            .update({ priority_score: 200 })
            .eq("user_id", userId);
        }
      }

      logger.debug(`Updated priorities: ${userIds.length} with positions, ${urgentUserIds.length} urgent`);

      await sleep(30 * 1000);
    } catch (error) {
      logger.error("Priority update loop error", error);
      await sleep(60 * 1000);
    }
  }
}

async function cleanupLoop(): Promise<void> {
  logger.info("Starting cleanup loop...");

  while (!getShutdownFlag()) {
    try {
      const released = await releaseStaleLocks();
      if (released > 0) {
        logger.info(`Released ${released} stale locks`);
      }

      const expired = await expireOldSignals();
      if (expired > 0) {
        logger.info(`Expired ${expired} old signals`);
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await supabase.from("user_rate_limits").delete().lt("minute_window", oneHourAgo);

      await supabase
        .from("trading_preferences")
        .update({ consecutive_failures: 0 })
        .gt("consecutive_failures", 0)
        .lt("last_evaluation_at", oneHourAgo);

      await sleep(60 * 60 * 1000);
    } catch (error) {
      logger.error("Cleanup loop error", error);
      await sleep(10 * 60 * 1000);
    }
  }
}

async function updateEngineStatus(status: string, errorMessage?: string): Promise<void> {
  const { data: activeUsers } = await supabase
    .from("trading_preferences")
    .select("user_id")
    .eq("auto_trading_enabled", true);

  await supabase.from("trading_engine_status").upsert(
    {
      engine_type: "trading_engine",
      status,
      last_heartbeat: new Date().toISOString(),
      active_users: activeUsers?.length || 0,
      error_message: errorMessage || null,
      started_at: status === "running" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "engine_type" }
  );
}

async function cleanup(): Promise<void> {
  logger.info("Running cleanup...");
  await updateEngineStatus("stopped");
}

async function main(): Promise<void> {
  logger.info("Trading Engine starting...");

  setupGracefulShutdown(cleanup);

  const released = await releaseStaleLocks();
  logger.info(`Released ${released} stale locks from previous session`);

  await updateEngineStatus("running");

  await Promise.all([
    evaluationLoop(),
    tokenRefreshLoop(),
    orderSyncLoop(),
    positionMonitorLoop(),
    priorityUpdateLoop(),
    cleanupLoop(),
  ]);
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
