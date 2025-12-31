import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface AIRecommendation {
  category: "zerodha" | "ai" | "database" | "scaling" | "user_experience";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  action: string;
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const [zerodhaConfigs, aiConfigs, userCount, tradeCount, healthSnapshots, loginLogs, auditLogs] = await Promise.all([
      supabaseAdmin.from("admin_zerodha_configs").select("*"),
      supabaseAdmin.from("admin_ai_configs").select("*"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("trade_history").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("system_health_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(24),
      supabaseAdmin
        .from("zerodha_login_logs")
        .select("*")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabaseAdmin
        .from("audit_logs")
        .select("*")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const recommendations: AIRecommendation[] = [];
    const zerodhaData = zerodhaConfigs.data || [];
    const aiData = aiConfigs.data || [];
    const totalUsers = userCount.count || 0;
    const totalTrades = tradeCount.count || 0;
    const loginLogsData = loginLogs.data || [];

    if (zerodhaData.length === 0) {
      recommendations.push({
        category: "zerodha",
        severity: "critical",
        title: "No Zerodha API Configured",
        description: "No Zerodha API keys are configured. Users won't be able to access market data.",
        action: "Add at least one Zerodha API configuration in the admin panel.",
      });
    } else {
      const connectedCount = zerodhaData.filter((c) => c.connection_status === "connected").length;
      const errorCount = zerodhaData.filter((c) => c.connection_status === "error").length;

      if (connectedCount === 0) {
        recommendations.push({
          category: "zerodha",
          severity: "critical",
          title: "No Active Zerodha Connections",
          description: "None of the configured Zerodha APIs are connected. Market data is unavailable.",
          action: "Manually trigger login for Zerodha configurations or check credentials.",
        });
      }

      if (errorCount > 0) {
        recommendations.push({
          category: "zerodha",
          severity: "warning",
          title: `${errorCount} Zerodha Connection(s) Failed`,
          description: "Some Zerodha API configurations have connection errors.",
          action: "Review error messages and fix credentials or retry connections.",
        });
      }

      if (totalUsers > 50 && zerodhaData.length < 2) {
        recommendations.push({
          category: "zerodha",
          severity: "warning",
          title: "Add More Zerodha APIs for Redundancy",
          description: `With ${totalUsers} users, having only ${zerodhaData.length} Zerodha API can cause rate limiting issues.`,
          action: "Add additional Zerodha API configurations to distribute the load.",
        });
      }

      const failedLogins = loginLogsData.filter((l) => l.status === "failed").length;
      if (failedLogins > 10) {
        recommendations.push({
          category: "zerodha",
          severity: "warning",
          title: "High Zerodha Login Failure Rate",
          description: `${failedLogins} failed login attempts in the last 7 days.`,
          action: "Check Zerodha credentials and TOTP secrets. Consider refreshing API keys.",
        });
      }
    }

    if (aiData.length === 0) {
      recommendations.push({
        category: "ai",
        severity: "critical",
        title: "No AI API Configured",
        description: "No AI API keys are configured. AI-powered features won't work.",
        action: "Add at least one AI API configuration (OpenAI, Claude, Gemini, or Groq).",
      });
    } else {
      const activeAI = aiData.filter((c) => c.is_active).length;
      const defaultAI = aiData.find((c) => c.is_default);

      if (activeAI === 0) {
        recommendations.push({
          category: "ai",
          severity: "critical",
          title: "No Active AI Configurations",
          description: "All AI configurations are disabled. AI features won't work.",
          action: "Enable at least one AI configuration.",
        });
      }

      if (!defaultAI) {
        recommendations.push({
          category: "ai",
          severity: "warning",
          title: "No Default AI Provider Set",
          description: "No AI provider is marked as default. The system will use the first available one.",
          action: "Set a default AI provider for consistent behavior.",
        });
      }

      const aiWithErrors = aiData.filter((c) => c.last_error).length;
      if (aiWithErrors > 0) {
        recommendations.push({
          category: "ai",
          severity: "warning",
          title: `${aiWithErrors} AI Configuration(s) Have Errors`,
          description: "Some AI configurations have recent errors.",
          action: "Test AI configurations and check API keys.",
        });
      }

      if (totalUsers > 100 && aiData.length < 2) {
        recommendations.push({
          category: "ai",
          severity: "info",
          title: "Consider Adding Backup AI Provider",
          description: "Having multiple AI providers ensures availability if one goes down.",
          action: "Add a secondary AI provider (e.g., if using OpenAI, add Claude as backup).",
        });
      }
    }

    if (totalUsers > 100) {
      recommendations.push({
        category: "scaling",
        severity: "info",
        title: "Growing User Base",
        description: `You have ${totalUsers} users. Consider scaling resources.`,
        action: "Review Supabase and Vercel plans. Consider upgrading to Pro plans for better performance.",
      });
    }

    if (totalTrades > 10000) {
      recommendations.push({
        category: "database",
        severity: "info",
        title: "Large Trade History",
        description: `${totalTrades} trades recorded. Consider archiving old data.`,
        action: "Implement data archival strategy for trades older than 1 year.",
      });
    }

    const now = new Date();
    const marketOpenIST = new Date(now);
    marketOpenIST.setUTCHours(3, 45, 0, 0);
    if (now.getDay() !== 0 && now.getDay() !== 6) {
      const tokenExpiringConfigs = zerodhaData.filter((c) => {
        if (!c.token_expires_at) return true;
        const expiry = new Date(c.token_expires_at);
        return expiry < now;
      });

      if (tokenExpiringConfigs.length > 0) {
        recommendations.push({
          category: "zerodha",
          severity: "warning",
          title: "Expired Zerodha Tokens",
          description: `${tokenExpiringConfigs.length} Zerodha token(s) have expired.`,
          action: "Tokens should auto-refresh, but manual login may be needed if auto-login failed.",
        });
      }
    }

    recommendations.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    await supabaseAdmin.from("system_health_snapshots").upsert({
      ai_recommendations: recommendations,
      created_at: new Date().toISOString(),
    });

    return successResponse({
      recommendations,
      summary: {
        critical: recommendations.filter((r) => r.severity === "critical").length,
        warning: recommendations.filter((r) => r.severity === "warning").length,
        info: recommendations.filter((r) => r.severity === "info").length,
      },
    });
  } catch (error) {
    console.error("Error generating AI analysis:", error);
    return serverErrorResponse();
  }
}
