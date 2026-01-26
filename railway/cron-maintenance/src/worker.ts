import { createClient, SupabaseClient } from "@supabase/supabase-js";
import cron from "node-cron";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[CronWorker] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log("[CronWorker] Cron Maintenance Worker starting...");
console.log("[CronWorker] Supabase URL:", supabaseUrl);

async function runHealthCheck() {
  console.log("[CronWorker] Running System Health Check...");
  try {
    const [zerodhaConfigs, aiConfigs, userCount, tradeCount, errorLogs] = await Promise.all([
      supabase.from("admin_zerodha_configs").select("*"),
      supabase.from("admin_ai_configs").select("*"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("trade_history").select("id", { count: "exact", head: true }),
      supabase
        .from("system_health_logs")
        .select("*")
        .eq("severity", "error")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const zerodhaData = zerodhaConfigs.data || [];
    const aiData = aiConfigs.data || [];
    const errorCount = errorLogs.data?.length || 0;

    const zerodhaConnected = zerodhaData.filter((c: any) => c.connection_status === "connected").length;
    const zerodhaErrors = zerodhaData.filter((c: any) => c.connection_status === "error").length;
    const aiActive = aiData.filter((c: any) => c.is_active).length;

    const now = new Date();
    const expiredTokens = zerodhaData.filter((c: any) => {
      if (!c.token_expires_at) return true;
      return new Date(c.token_expires_at) < now;
    });

    let overallHealth = "healthy";
    const issues: string[] = [];

    if (zerodhaData.length === 0) {
      overallHealth = "critical";
      issues.push("No Zerodha APIs configured");
    } else if (zerodhaConnected === 0) {
      overallHealth = "critical";
      issues.push("No Zerodha connections active");
    } else if (zerodhaErrors > 0 || expiredTokens.length > 0) {
      overallHealth = "warning";
      if (zerodhaErrors > 0) issues.push(`${zerodhaErrors} Zerodha connection errors`);
      if (expiredTokens.length > 0) issues.push(`${expiredTokens.length} expired tokens`);
    }

    if (aiData.length === 0) {
      if (overallHealth !== "critical") overallHealth = "warning";
      issues.push("No AI providers configured");
    } else if (aiActive === 0) {
      if (overallHealth !== "critical") overallHealth = "warning";
      issues.push("No AI providers active");
    }

    if (errorCount > 10) {
      if (overallHealth !== "critical") overallHealth = "warning";
      issues.push(`${errorCount} errors in last 24h`);
    }

    const snapshot = {
      zerodha_status: {
        total: zerodhaData.length,
        connected: zerodhaConnected,
        errors: zerodhaErrors,
        expired_tokens: expiredTokens.length,
      },
      ai_status: {
        total: aiData.length,
        active: aiActive,
        inactive: aiData.length - aiActive,
      },
      database_status: {
        status: "healthy",
        total_users: userCount.count || 0,
        total_trades: tradeCount.count || 0,
      },
      user_metrics: {
        total: userCount.count || 0,
      },
      api_metrics: {
        errors_24h: errorCount,
      },
      error_summary: {
        total_24h: errorCount,
      },
    };

    await supabase.from("system_health_snapshots").insert(snapshot);

    await supabase.from("system_health_logs").insert({
      metric_type: "health_check",
      metric_value: { ...snapshot, overall_health: overallHealth, issues },
      severity: overallHealth === "critical" ? "error" : overallHealth === "warning" ? "warning" : "info",
      message: issues.length > 0 ? issues.join("; ") : "All systems operational",
    });

    console.log(`[CronWorker] Health check complete: ${overallHealth}`, issues);
  } catch (err) {
    console.error("[CronWorker] Error during health check:", err);
  }
}

async function runDatabaseCleanup() {
  console.log("[CronWorker] Running Database Cleanup...");
  try {
    const results: Record<string, number | string> = {};

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { count: ticksDeleted, error: ticksError } = await supabase
      .from("realtime_ticks")
      .delete({ count: "exact" })
      .lt("tick_timestamp", threeDaysAgo.toISOString());

    if (ticksError) {
      results.ticks_error = ticksError.message;
    } else {
      results.ticks_deleted = ticksDeleted || 0;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: logsDeleted, error: logsError } = await supabase
      .from("system_health_logs")
      .delete({ count: "exact" })
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (logsError) {
      results.logs_error = logsError.message;
    } else {
      results.logs_deleted = logsDeleted || 0;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: candlesDeleted, error: candlesError } = await supabase
      .from("live_candles")
      .delete({ count: "exact" })
      .lt("timestamp", sevenDaysAgo.toISOString());

    if (candlesError) {
      results.candles_error = candlesError.message;
    } else {
      results.candles_deleted = candlesDeleted || 0;
    }

    const { count: snapshotsDeleted, error: snapshotsError } = await supabase
      .from("system_health_snapshots")
      .delete({ count: "exact" })
      .lt("created_at", sevenDaysAgo.toISOString());

    if (snapshotsError) {
      results.snapshots_error = snapshotsError.message;
    } else {
      results.snapshots_deleted = snapshotsDeleted || 0;
    }

    await supabase.from("system_health_logs").insert({
      metric_type: "database_cleanup",
      metric_value: results,
      severity: "info",
      message: `Cleanup: ${results.ticks_deleted || 0} ticks, ${results.logs_deleted || 0} logs, ${results.candles_deleted || 0} candles deleted`,
    });

    console.log("[CronWorker] Database cleanup complete:", results);
  } catch (err) {
    console.error("[CronWorker] Error during database cleanup:", err);
  }
}

async function runInstrumentAggregation() {
  console.log("[CronWorker] Running Instrument Aggregation...");
  try {
    const { data: activeStrategies, error: stratError } = await supabase
      .from("strategies")
      .select("id, name, selected_instruments, user_id")
      .eq("is_active", true)
      .eq("admin_approved", true);

    if (stratError) {
      throw new Error(stratError.message);
    }

    if (!activeStrategies || activeStrategies.length === 0) {
      console.log("[CronWorker] No active strategies found");
      return;
    }

    const instrumentsToAdd: Array<{
      instrument_token: number;
      tradingsymbol: string;
      exchange: string;
      instrument_type: string;
      source_type: string;
      source_id: string;
      user_id: string;
      is_active: boolean;
      priority: number;
      candle_depth: number;
    }> = [];

    for (const strategy of activeStrategies) {
      const instruments = strategy.selected_instruments || [];

      for (const inst of instruments) {
        if (!inst.instrument_token) continue;

        instrumentsToAdd.push({
          instrument_token: inst.instrument_token,
          tradingsymbol: inst.tradingsymbol || inst.symbol || "UNKNOWN",
          exchange: inst.exchange || "NSE",
          instrument_type: inst.instrument_type || "EQ",
          source_type: "STRATEGY",
          source_id: String(strategy.id),
          user_id: strategy.user_id,
          is_active: true,
          priority: 1,
          candle_depth: 50,
        });
      }
    }

    if (instrumentsToAdd.length > 0) {
      await supabase
        .from("active_trade_instruments")
        .upsert(instrumentsToAdd, { onConflict: "instrument_token,source_type,source_id" });
    }

    const { data: inactiveStrategies } = await supabase
      .from("strategies")
      .select("id")
      .or("is_active.eq.false,admin_approved.eq.false");

    if (inactiveStrategies && inactiveStrategies.length > 0) {
      const inactiveIds = inactiveStrategies.map((s: { id: number }) => String(s.id));

      await supabase
        .from("active_trade_instruments")
        .update({ is_active: false })
        .eq("source_type", "STRATEGY")
        .in("source_id", inactiveIds);
    }

    console.log(`[CronWorker] Aggregated ${instrumentsToAdd.length} instruments from ${activeStrategies.length} strategies`);
  } catch (err) {
    console.error("[CronWorker] Error during instrument aggregation:", err);
  }
}

async function runOptionRoll() {
  console.log("[CronWorker] Running Option Roll Service...");
  try {
    const errors: string[] = [];
    let rolled = 0;

    const { data: configs, error: configError } = await supabase
      .from("option_roll_config")
      .select("*")
      .eq("is_active", true);

    if (configError) {
      console.error("[CronWorker] Failed to fetch option roll configs:", configError.message);
      return;
    }

    if (!configs || configs.length === 0) {
      console.log("[CronWorker] No active option roll configs found");
      return;
    }

    for (const config of configs) {
      try {
        const underlyingPrice = await getUnderlyingPrice(supabase, config.underlying_token);
        if (!underlyingPrice) {
          errors.push(`Could not get price for ${config.underlying_symbol}`);
          continue;
        }

        const strikeGap = config.underlying_symbol === "BANKNIFTY" ? 100 : 50;
        const atmStrike = Math.round(underlyingPrice / strikeGap) * strikeGap;

        const strikes: number[] = [];
        for (let i = -config.strike_range; i <= config.strike_range; i++) {
          strikes.push(atmStrike + i * strikeGap);
        }

        const today = new Date();
        const { data: allExpiries } = await supabase
          .from("instruments")
          .select("expiry")
          .eq("exchange", config.exchange)
          .ilike("tradingsymbol", `${config.underlying_symbol}%`)
          .in("instrument_type", config.option_types || ["CE", "PE"])
          .gte("expiry", today.toISOString().split("T")[0])
          .order("expiry", { ascending: true });

        if (!allExpiries || allExpiries.length === 0) {
          errors.push(`No expiries found for ${config.underlying_symbol}`);
          continue;
        }

        const uniqueExpiries = [...new Set(allExpiries.map((e: { expiry: string }) => e.expiry))];
        const expiriesToUse: string[] = [];

        if (config.include_weekly && uniqueExpiries.length > 0) {
          expiriesToUse.push(uniqueExpiries[0]);
        }
        if (config.include_next_expiry && uniqueExpiries.length > 1) {
          expiriesToUse.push(uniqueExpiries[1]);
        }

        const { data: existingOptions } = await supabase
          .from("scanner_instruments")
          .select("instrument_token")
          .eq("category", `OPTION_${config.underlying_symbol}`);

        const existingTokens = new Set((existingOptions || []).map((o: { instrument_token: number }) => o.instrument_token));

        const optionsToAdd: any[] = [];

        for (const expiry of expiriesToUse) {
          for (const strike of strikes) {
            for (const optionType of config.option_types || ["CE", "PE"]) {
              const { data: option } = await supabase
                .from("instruments")
                .select("*")
                .eq("exchange", config.exchange)
                .eq("strike", strike)
                .eq("expiry", expiry)
                .eq("instrument_type", optionType)
                .ilike("tradingsymbol", `${config.underlying_symbol}%`)
                .single();

              if (option && !existingTokens.has(option.instrument_token)) {
                optionsToAdd.push({
                  instrument_token: option.instrument_token,
                  tradingsymbol: option.tradingsymbol,
                  exchange: option.exchange,
                  segment: option.segment,
                  instrument_type: option.instrument_type,
                  name: option.name,
                  lot_size: option.lot_size,
                  expiry: option.expiry,
                  strike: option.strike,
                  is_auto_updated: true,
                  auto_update_config: { underlying: config.underlying_symbol, atm_strike: atmStrike },
                  is_active: true,
                  category: `OPTION_${config.underlying_symbol}`,
                });
              }
            }
          }
        }

        if (optionsToAdd.length > 0) {
          await supabase
            .from("scanner_instruments")
            .upsert(optionsToAdd, { onConflict: "instrument_token" });
          rolled += optionsToAdd.length;
        }

        const todayStr = today.toISOString().split("T")[0];
        const { data: expired } = await supabase
          .from("scanner_instruments")
          .select("instrument_token")
          .eq("category", `OPTION_${config.underlying_symbol}`)
          .lt("expiry", todayStr);

        if (expired && expired.length > 0) {
          const tokens = expired.map((e: { instrument_token: number }) => e.instrument_token);
          await supabase.from("scanner_instruments").delete().in("instrument_token", tokens);
        }

        await supabase
          .from("option_roll_config")
          .update({
            last_roll_at: new Date().toISOString(),
            last_roll_status: "success",
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);

      } catch (err) {
        errors.push(`${config.underlying_symbol}: ${err}`);
      }
    }

    await supabase.from("system_health_logs").insert({
      metric_type: "option_roll",
      metric_value: { rolled, errors },
      severity: errors.length === 0 ? "info" : "warning",
      message: `Option Roll: ${rolled} instruments rolled${errors.length > 0 ? `, ${errors.length} errors` : ""}`,
    });

    console.log(`[CronWorker] Option roll complete: ${rolled} rolled, ${errors.length} errors`);
  } catch (err) {
    console.error("[CronWorker] Error during option roll:", err);
  }
}

async function getUnderlyingPrice(sb: SupabaseClient, token: number): Promise<number | null> {
  const { data: tick } = await sb
    .from("realtime_ticks")
    .select("last_price")
    .eq("instrument_token", token)
    .order("tick_timestamp", { ascending: false })
    .limit(1)
    .single();

  if (tick) return tick.last_price;

  const { data: candle } = await sb
    .from("live_candles")
    .select("close")
    .eq("instrument_token", token)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  return candle?.close || null;
}

async function sendHeartbeat() {
  try {
    await supabase.from("trading_engine_status").upsert({
      engine_type: "cron_maintenance",
      status: "running",
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });
  } catch (err) {
    console.error("[CronWorker] Heartbeat failed:", err);
  }
}

cron.schedule("*/5 * * * *", runHealthCheck);

cron.schedule("0 18 * * *", runDatabaseCleanup);

cron.schedule("*/5 * * * *", runInstrumentAggregation);

cron.schedule("30 0 * * *", runOptionRoll);

setInterval(sendHeartbeat, 30000);

console.log("[CronWorker] All schedules initialized:");
console.log("  - Health Check: every 5 minutes");
console.log("  - Database Cleanup: daily at midnight IST (18:30 UTC)");
console.log("  - Instrument Aggregation: every 5 minutes");
console.log("  - Option Roll: daily at 6:00 AM IST (00:30 UTC)");
console.log("  - Heartbeat: every 30 seconds");

sendHeartbeat();
runHealthCheck();
