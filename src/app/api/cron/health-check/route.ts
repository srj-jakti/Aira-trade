import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function runHealthCheck() {
  const [zerodhaConfigs, aiConfigs, userCount, tradeCount, errorLogs] = await Promise.all([
    supabaseAdmin.from("admin_zerodha_configs").select("*"),
    supabaseAdmin.from("admin_ai_configs").select("*"),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("trade_history").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("system_health_logs")
      .select("*")
      .eq("severity", "error")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const zerodhaData = zerodhaConfigs.data || [];
  const aiData = aiConfigs.data || [];
  const errorCount = errorLogs.data?.length || 0;

  const zerodhaConnected = zerodhaData.filter((c) => c.connection_status === "connected").length;
  const zerodhaErrors = zerodhaData.filter((c) => c.connection_status === "error").length;
  const aiActive = aiData.filter((c) => c.is_active).length;

  const now = new Date();
  const expiredTokens = zerodhaData.filter((c) => {
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

  await supabaseAdmin.from("system_health_snapshots").insert(snapshot);

  await supabaseAdmin.from("system_health_logs").insert({
    metric_type: "health_check",
    metric_value: { ...snapshot, overall_health: overallHealth, issues },
    severity: overallHealth === "critical" ? "error" : overallHealth === "warning" ? "warning" : "info",
    message: issues.length > 0 ? issues.join("; ") : "All systems operational",
  });

  if (overallHealth === "critical" || (overallHealth === "warning" && expiredTokens.length > 0)) {
    console.log(`Health check alert: ${overallHealth} - ${issues.join(", ")}`);
  }

  return {
    status: overallHealth,
    issues,
    snapshot,
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runHealthCheck();
    return successResponse(result);
  } catch (error) {
    console.error("Error in health check cron:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runHealthCheck();
    return successResponse(result);
  } catch (error) {
    console.error("Error in health check cron:", error);
    return serverErrorResponse();
  }
}
