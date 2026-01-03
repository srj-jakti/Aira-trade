/**
 * TRADING ENGINE - Railway Deployment
 * 24/7 persistent background AI auto-trading service
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
executePaperOrder,
fetchOrderStatus,
closePosition,
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
  paper_trading_enabled: boolean;
  daily_profit_limit: number;
  daily_loss_limit: number;
  daily_pnl_realized: number;
}

// NEW: Check if user's daily quota is already hit
async function checkDailyQuotaHit(userId: string): Promise<{ hit: boolean; reason?: string }> {
  const { data } = await supabase
    .from("trading_preferences")
    .select("daily_profit_limit, daily_loss_limit, daily_pnl_realized")
    .eq("user_id", userId)
    .single();

  if (!data) return { hit: false };

  const { daily_profit_limit, daily_loss_limit, daily_pnl_realized } = data;

  const realizedPnL = parseFloat(daily_pnl_realized as unknown as string) || 0;
  const profitLimit = parseFloat(daily_profit_limit as unknown as string) || 0;
  const lossLimit = parseFloat(daily_loss_limit as unknown as string) || 0;

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
async function autoDisableOnQuotaHit(userId: string, reason: string): Promise<void> {
  await supabase
    .from("trading_preferences")
    .update({
      auto_trading_enabled: false,
      daily_quota_hit_at: new Date().toISOString(),
      daily_quota_reason: reason,
      evaluation_error: reason,
      execution_lock: false,
    })
    .eq("user_id", userId);

  logger.warn(`[QUOTA HIT] Auto-trading disabled for ${userId}: ${reason}`);
  
  // Log audit event - using standard supabase call since we don't have logAudit utility in engine
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "trading_auto_disabled",
    target_table: "trading_preferences",
    metadata: { reason, triggered_by: "daily_quota_limit" },
  });
}

async function processUser(user: TradingPreference): Promise<void> {
  const { user_id } = user;

  // FIRST: Check if daily quota already hit
  const quotaCheck = await checkDailyQuotaHit(user_id);
  if (quotaCheck.hit) {
    await autoDisableOnQuotaHit(user_id, quotaCheck.reason!);
    return; // Skip this user entirely
  }

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

    let broker = null;
    if (!user.paper_trading_enabled) {
      broker = await getBrokerCredentials(user_id);
      if (!broker || !broker.access_token) {
        evaluationError = "No valid broker token";
        return;
      }

      if (isTokenExpired(broker.token_expires_at)) {
        evaluationError = "Broker token expired";
        await markTokenExpired(user_id);
        return;
      }
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

      await updateSignalStatus(signalId, "EXECUTING", "Placing order");

      try {
        let orderResult;
        const config = {
          user_id,
          risk_per_trade: user.risk_per_trade || 1,
          max_daily_loss: user.max_daily_loss || 1000,
          max_trades_per_day: user.max_trades_per_day || 10,
        };

        if (user.paper_trading_enabled) {
          orderResult = await executePaperOrder(user_id, signal, config, strategy.id);
        } else if (broker) {
          orderResult = await executeOrder(user_id, broker, signal, config, strategy.id);
        } else {
          throw new Error("No broker credentials for live trade");
        }

        await updateSignalStatus(
          signalId,
          "EXECUTED",
          `Order ID: ${orderResult.order_id}`,
          orderResult.order_id
        );

        await incrementRateLimit(user_id, "order");
        logger.info(`${user.paper_trading_enabled ? 'Paper' : 'Live'} trade executed for user ${user_id}: ${orderResult.order_id}`);
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

async function monitorPositions(tableName: "user_positions" | "paper_positions"): Promise<void> {
    const { data: positions } = await supabase
      .from(tableName)
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
        .from(tableName)
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
          if (tableName === "user_positions") {
            try {
              const broker = await getBrokerCredentials(position.user_id);
              if (broker) {
                const closeResult = await closePosition(
                  position.user_id,
                  broker,
                  {
                    tradingsymbol: position.tradingsymbol,
                    quantity: position.quantity,
                    position_type: position.position_type,
                  },
                  exitReason
                );
                
                if (!closeResult.success) {
                  logger.error(`[LIVE] Failed to execute broker exit for ${position.id}: ${closeResult.error}`);
                  continue; 
                }

                // Update ai_signals for P&L tracking
                const { data: latestSignal } = await supabase
                  .from("ai_signals")
                  .select("id")
                  .eq("user_id", position.user_id)
                  .eq("tradingsymbol", position.tradingsymbol)
                  .eq("signal_status", "EXECUTED")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .single();

                if (latestSignal) {
                  await supabase.from("ai_signals").update({
                    exit_price: currentPrice,
                    exit_at: new Date().toISOString(),
                    pnl: pnl,
                    signal_status: "CLOSED",
                    status_reason: exitReason
                  }).eq("id", latestSignal.id);
                }
              } else {
                logger.error(`[LIVE] No broker credentials to close position ${position.id}`);
                continue;
              }
            } catch (err) {
              logger.error(`[LIVE] Error during position exit for ${position.id}`, err);
              continue;
            }
          } else {
            // Paper Trade History
            await supabase.from("paper_trade_history").insert({
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

            await supabase
              .from(tableName)
              .update({
                status: "CLOSED",
                exit_price: currentPrice,
                exit_reason: exitReason,
                closed_at: new Date().toISOString(),
              })
              .eq("id", position.id);

            // NEW: Update daily PnL and check quota
            await supabase.rpc("increment_daily_pnl", {
              user_id_val: position.user_id,
              pnl_val: pnl,
            });

            const quotaCheck = await checkDailyQuotaHit(position.user_id);
            if (quotaCheck.hit) {
              await autoDisableOnQuotaHit(position.user_id, quotaCheck.reason!);
            }

            logger.info(`[${tableName === 'paper_positions' ? 'PAPER' : 'LIVE'}] Position ${position.id} closed: ${exitReason} | P&L: ${pnl.toFixed(2)}`);
          }

    }
}

async function positionMonitorLoop(): Promise<void> {
  logger.info("Starting position monitor loop...");

  while (!getShutdownFlag()) {
    try {
      await monitorPositions("user_positions");
      await monitorPositions("paper_positions");
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

      const { data: livePos } = await supabase.from("user_positions").select("user_id").eq("status", "OPEN");
      const { data: paperPos } = await supabase.from("paper_positions").select("user_id").eq("status", "OPEN");

      const userIds = [...new Set([
        ...(livePos || []).map((u) => u.user_id),
        ...(paperPos || []).map((u) => u.user_id)
      ])];

      if (userIds.length > 0) {
        for (const userId of userIds) {
          await supabase
            .from("trading_preferences")
            .update({ priority_score: 100 })
            .eq("user_id", userId);
        }
      }

      const { data: liveUrgent } = await supabase
        .from("user_positions")
        .select("user_id")
        .eq("status", "OPEN")
        .lt("unrealized_pnl_percent", -2);

      const { data: paperUrgent } = await supabase
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
