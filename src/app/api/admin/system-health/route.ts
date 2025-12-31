import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface SystemHealthData {
  zerodha: {
    total: number;
    connected: number;
    disconnected: number;
    errors: number;
    configs: Array<{
      id: string;
      name: string;
      status: string;
      lastLogin: string | null;
      tokenExpiry: string | null;
      lastError: string | null;
    }>;
  };
  ai: {
    total: number;
    active: number;
    inactive: number;
    errors: number;
    configs: Array<{
      id: string;
      provider: string;
      model: string;
      isActive: boolean;
      isDefault: boolean;
      lastError: string | null;
      requestCount: number;
    }>;
  };
  database: {
    status: string;
    totalUsers: number;
    activeUsers24h: number;
    totalTrades: number;
    totalStrategies: number;
  };
  api: {
    totalRequests24h: number;
    avgResponseTime: number;
    errorRate: number;
  };
  errors: {
    zerodhaErrors24h: number;
    aiErrors24h: number;
    authErrors24h: number;
    recentErrors: Array<{
      type: string;
      message: string;
      timestamp: string;
    }>;
  };
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const [zerodhaConfigs, aiConfigs, userCount, tradeCount, strategyCount, healthLogs, loginLogs, engineStatus] = await Promise.all([
      supabaseAdmin.from("admin_zerodha_configs").select("*").order("priority"),
      supabaseAdmin.from("admin_ai_configs").select("*").order("priority"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("trade_history").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("strategies").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("system_health_logs")
        .select("*")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("zerodha_login_logs")
        .select("*")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("data_engine_status").select("*"),
    ]);

    const zerodhaData = zerodhaConfigs.data || [];
    const aiData = aiConfigs.data || [];

    const health: SystemHealthData & { engines: any[] } = {
      zerodha: {
        total: zerodhaData.length,
        connected: zerodhaConnected,
        disconnected: zerodhaData.length - zerodhaConnected - zerodhaErrors,
        errors: zerodhaErrors,
        configs: zerodhaData.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.connection_status,
          lastLogin: c.last_login_at,
          tokenExpiry: c.token_expires_at,
          lastError: c.last_error,
        })),
      },
      ai: {
        total: aiData.length,
        active: aiActive,
        inactive: aiData.length - aiActive,
        errors: aiErrors,
        configs: aiData.map((c) => ({
          id: c.id,
          provider: c.provider,
          model: c.model,
          isActive: c.is_active,
          isDefault: c.is_default,
          lastError: c.last_error,
          requestCount: c.request_count,
        })),
      },
      database: {
        status: "healthy",
        totalUsers: userCount.count || 0,
        activeUsers24h: 0,
        totalTrades: tradeCount.count || 0,
        totalStrategies: strategyCount.count || 0,
      },
      api: {
        totalRequests24h: (healthLogs.data || []).length,
        avgResponseTime: 0,
        errorRate: 0,
      },
      engines: (engineStatus.data || []).map(e => ({
        type: e.engine_type,
        last_instrument_sync_at: e.last_instrument_sync_at,
        auto_sync_instruments: e.auto_sync_instruments,
        status: e.status,
        last_run_at: e.last_run_at
      })),
      errors: {
        zerodhaErrors24h: failedLogins,
        aiErrors24h: (healthLogs.data || []).filter((l) => l.metric_type === "ai_error").length,
        authErrors24h: (healthLogs.data || []).filter((l) => l.metric_type === "auth_error").length,
        recentErrors: (healthLogs.data || [])
          .filter((l) => l.severity === "error")
          .slice(0, 10)
          .map((l) => ({
            type: l.metric_type,
            message: l.message || "Unknown error",
            timestamp: l.created_at,
          })),
      },
    };

    await supabaseAdmin.from("system_health_snapshots").insert({
      zerodha_status: health.zerodha,
      ai_status: health.ai,
      database_status: health.database,
      api_metrics: health.api,
      error_summary: health.errors,
    });

    return successResponse({ health });
  } catch (error) {
    console.error("Error fetching system health:", error);
    return serverErrorResponse();
  }
}
