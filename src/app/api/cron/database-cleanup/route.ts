import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: Record<string, number | string> = {};

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { count: ticksDeleted, error: ticksError } = await supabaseAdmin
      .from("realtime_ticks")
      .delete({ count: "exact" })
      .lt("tick_timestamp", threeDaysAgo.toISOString());

    if (ticksError) {
      console.error("[DatabaseCleanup] Error deleting old ticks:", ticksError.message);
      results.ticks_error = ticksError.message;
    } else {
      results.ticks_deleted = ticksDeleted || 0;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: logsDeleted, error: logsError } = await supabaseAdmin
      .from("system_health_logs")
      .delete({ count: "exact" })
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (logsError) {
      console.error("[DatabaseCleanup] Error deleting old logs:", logsError.message);
      results.logs_error = logsError.message;
    } else {
      results.logs_deleted = logsDeleted || 0;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: candlesDeleted, error: candlesError } = await supabaseAdmin
      .from("live_candles")
      .delete({ count: "exact" })
      .lt("timestamp", sevenDaysAgo.toISOString());

    if (candlesError) {
      console.error("[DatabaseCleanup] Error deleting old candles:", candlesError.message);
      results.candles_error = candlesError.message;
    } else {
      results.candles_deleted = candlesDeleted || 0;
    }

    const { count: snapshotsDeleted, error: snapshotsError } = await supabaseAdmin
      .from("system_health_snapshots")
      .delete({ count: "exact" })
      .lt("created_at", sevenDaysAgo.toISOString());

    if (snapshotsError) {
      console.error("[DatabaseCleanup] Error deleting old snapshots:", snapshotsError.message);
      results.snapshots_error = snapshotsError.message;
    } else {
      results.snapshots_deleted = snapshotsDeleted || 0;
    }

    await supabaseAdmin.from("system_health_logs").insert({
      metric_type: "database_cleanup",
      metric_value: results,
      severity: "info",
      message: `Cleanup completed: ${results.ticks_deleted || 0} ticks, ${results.logs_deleted || 0} logs, ${results.candles_deleted || 0} candles, ${results.snapshots_deleted || 0} snapshots deleted`,
    });

    return successResponse({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[DatabaseCleanup] Error:", error);
    return serverErrorResponse();
  }
}
