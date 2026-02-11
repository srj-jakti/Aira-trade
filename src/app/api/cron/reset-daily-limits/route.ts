import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CRON] Starting daily limits reset...");

    // Call the database function to reset daily P&L
    const { data, error } = await supabaseAdmin.rpc("reset_daily_pnl");

    if (error) {
      console.error("[CRON] Error resetting daily limits:", error);
      return Response.json(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    console.log("[CRON] Daily limits reset successfully");

    // Log the reset in audit logs
    await supabaseAdmin.from("audit_logs").insert({
      action: "daily_limits_reset",
      target_table: "trading_preferences",
      metadata: {
        triggered_by: "cron",
        timestamp: new Date().toISOString(),
      },
    });

    return Response.json({
      success: true,
      message: "Daily limits reset successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Fatal error in daily reset:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
