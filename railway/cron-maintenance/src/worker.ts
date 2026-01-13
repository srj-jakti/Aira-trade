import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";
import cron from "node-cron";

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
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { count, error } = await supabase
      .from("realtime_ticks")
      .delete({ count: "exact" })
      .lt("tick_timestamp", threeDaysAgo.toISOString());

    if (error) throw error;
    console.log(`[CronWorker] Cleaned up ${count} old ticks`);

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
 * 5. EXPIRED INSTRUMENTS CLEANUP
 * Runs every day at 6:00 AM IST (00:30 UTC)
 * Removes expired F&O from instruments and unsubscribes them
 */
cron.schedule("30 0 * * *", async () => {
  console.log("[CronWorker] Running Expired Instruments Cleanup...");
  try {
    const today = new Date().toISOString().split("T")[0];
    
    const { data: expired, error: fetchError } = await supabase
      .from("instruments")
      .select("instrument_token, tradingsymbol, expiry")
      .lt("expiry", today)
      .not("expiry", "is", null)
      .eq("is_subscribed", true);

    if (fetchError) throw fetchError;
    
    if (expired && expired.length > 0) {
      const tokens = expired.map(e => e.instrument_token);
      
      const { error: updateError } = await supabase
        .from("instruments")
        .update({
          is_subscribed: false,
          subscription_priority: "expired",
          updated_at: new Date().toISOString(),
        })
        .in("instrument_token", tokens);

      if (updateError) throw updateError;
      
      console.log(`[CronWorker] Unsubscribed ${tokens.length} expired instruments`);
      
      await supabase.from("system_health_logs").insert({
        metric_type: "expired_cleanup",
        metric_value: { count: tokens.length, symbols: expired.slice(0, 10).map(e => e.tradingsymbol) },
        severity: "info",
        message: `Cleaned up ${tokens.length} expired instruments`,
      });
    } else {
      console.log("[CronWorker] No expired instruments to clean up");
    }
  } catch (err) {
    console.error("[CronWorker] Error during expired instruments cleanup:", err);
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
