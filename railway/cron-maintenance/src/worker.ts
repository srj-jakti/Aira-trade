import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";
import cron from "node-cron";
import { OptionRollService } from "./option-roll";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[CronWorker] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const redis = new Redis(redisUrl);
const optionRollService = new OptionRollService(supabase);

console.log("[CronWorker] Cron Maintenance Worker starting...");

/**
 * 1. ZERODHA AUTO LOGIN
 * Runs every day at 8:45 AM (before market open) and every 2 hours during market
 */
cron.schedule("45 8 * * *", async () => {
  console.log("[CronWorker] Running scheduled Zerodha Auto Login (8:45 AM)...");
  await triggerAutoLogin("market_open_prep");
});

cron.schedule("0 */2 9-15 * * 1-5", async () => {
  console.log("[CronWorker] Running periodic Zerodha Auto Login check...");
  await triggerAutoLogin("periodic_check");
});

async function triggerAutoLogin(reason: string) {
  try {
    const response = await fetch(`${appUrl}/api/cron/zerodha-auto-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ triggerType: "cron_worker", reason }),
    });

    if (response.ok) {
      console.log(`[CronWorker] Auto-login triggered successfully: ${reason}`);
    } else {
      console.error(`[CronWorker] Auto-login trigger failed: ${await response.text()}`);
    }
  } catch (err) {
    console.error("[CronWorker] Error triggering auto-login:", err);
  }
}

/**
 * 2. SYSTEM HEALTH CHECK
 * Runs every 5 minutes
 */
cron.schedule("*/5 * * * *", async () => {
  console.log("[CronWorker] Running System Health Check...");
  try {
    const response = await fetch(`${appUrl}/api/cron/health-check`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
    });
    if (!response.ok) {
      console.error("[CronWorker] Health check failed:", await response.text());
    }
  } catch (err) {
    console.error("[CronWorker] Error during health check:", err);
  }
});

/**
 * 3. REFRESH SUBSCRIPTIONS
 * Runs every hour
 */
cron.schedule("0 * * * *", async () => {
  console.log("[CronWorker] Running Subscription Refresh...");
  try {
    const response = await fetch(`${appUrl}/api/cron/refresh-subscriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
    });
    if (!response.ok) {
      console.error("[CronWorker] Subscription refresh failed:", await response.text());
    }
  } catch (err) {
    console.error("[CronWorker] Error during subscription refresh:", err);
  }
});

/**
 * 4. DATABASE CLEANUP (Cold Path Maintenance)
 * Runs daily at midnight
 * Moves old ticks to history or deletes them to prevent DB bloat
 */
cron.schedule("0 0 * * *", async () => {
  console.log("[CronWorker] Running Database Cleanup...");
  try {
    // Keep only last 3 days of realtime_ticks
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { count, error } = await supabase
      .from("realtime_ticks")
      .delete({ count: "exact" })
      .lt("tick_timestamp", threeDaysAgo.toISOString());

    if (error) throw error;
    console.log(`[CronWorker] Cleaned up ${count} old ticks`);

    // Keep only last 30 days of system_health_logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await supabase
      .from("system_health_logs")
      .delete()
      .lt("created_at", thirtyDaysAgo.toISOString());

  } catch (err) {
    console.error("[CronWorker] Error during database cleanup:", err);
  }
});

/**
 * 5. OPTION ROLL SERVICE
 * Runs daily at 6:00 AM IST (before market open)
 * Updates option instruments to latest expiry with ATM strikes
 */
cron.schedule("30 0 * * *", async () => {
  console.log("[CronWorker] Running Option Roll Service (6:00 AM IST)...");
  try {
    const result = await optionRollService.rollOptions();
    
    await supabase.from("system_health_logs").insert({
      metric_type: "option_roll",
      metric_value: { rolled: result.rolled, errors: result.errors },
      severity: result.success ? "info" : "warning",
      message: `Option Roll: ${result.rolled} instruments rolled${result.errors.length > 0 ? `, ${result.errors.length} errors` : ""}`,
    });

    if (result.success) {
      console.log(`[CronWorker] Option Roll completed: ${result.rolled} instruments rolled`);
    } else {
      console.error(`[CronWorker] Option Roll completed with errors:`, result.errors);
    }
  } catch (err) {
    console.error("[CronWorker] Error during option roll:", err);
    await supabase.from("system_health_logs").insert({
      metric_type: "option_roll_error",
      metric_value: { error: String(err) },
      severity: "error",
      message: `Option Roll failed: ${err}`,
    });
  }
});

/**
 * 6. STRATEGY INSTRUMENT AGGREGATION
 * Runs every 5 minutes to sync instruments from active strategies
 */
cron.schedule("*/5 * * * *", async () => {
  try {
    const response = await fetch(`${appUrl}/api/cron/aggregate-instruments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
    });
    if (!response.ok) {
      console.error("[CronWorker] Instrument aggregation failed:", await response.text());
    }
  } catch (err) {
    console.error("[CronWorker] Error during instrument aggregation:", err);
  }
});

// Heartbeat to Supabase to show worker is alive
setInterval(async () => {
  try {
    await supabase.from("data_engine_status").upsert({
      engine_type: "cron_maintenance",
      status: "running",
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "engine_type" });
  } catch (err) {
    console.error("[CronWorker] Heartbeat failed:", err);
  }
}, 30000);

console.log("[CronWorker] All schedules initialized.");
