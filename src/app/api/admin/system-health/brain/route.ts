import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  successResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { airaBrain } from "@/lib/server/aira-brain";
import { aiKeyAutoScaler } from "@/lib/server/ai-key-auto-scaler";
import { selfLearningEngine } from "@/lib/server/self-learning-engine";
import { brainAuditLogger } from "@/lib/server/brain-audit-logger";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.user.id)
    .single();

  if (profile?.role !== "admin") {
    return unauthorizedResponse();
  }

  try {
    const brainHealth = airaBrain.getHealth();
    const aiKeyStatus = await aiKeyAutoScaler.getScalingStatus();
    const learningStats = await selfLearningEngine.getLearningStats();
    const auditStats = await brainAuditLogger.getAuditStats();

    const { data: recentHeartbeats } = await supabaseAdmin
      .from("brain_heartbeats")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: recentEvents } = await supabaseAdmin
      .from("brain_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    const { count: gatewayLogsCount } = await supabaseAdmin
      .from("intent_gateway_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { count: gatewayViolationsCount } = await supabaseAdmin
      .from("intent_gateway_violations")
      .select("*", { count: "exact", head: true });

    return successResponse({
      brain: {
        state: brainHealth.state,
        uptime: brainHealth.uptime,
        requestsProcessed: brainHealth.requestsProcessed,
        errorsCount: brainHealth.errorsCount,
        lastHeartbeat: brainHealth.lastHeartbeat,
      },
      aiKeys: aiKeyStatus,
      learning: learningStats,
      audit: {
        ...auditStats,
        gatewayLogsLast24h: gatewayLogsCount || 0,
        totalViolations: gatewayViolationsCount || 0,
      },
      recentHeartbeats: recentHeartbeats || [],
      recentEvents: recentEvents || [],
      systemStatus: determineSystemStatus(brainHealth, aiKeyStatus, gatewayViolationsCount || 0),
    });
  } catch (error) {
    console.error("[Admin Brain Health] Error:", error);
    return serverErrorResponse("Failed to fetch brain health");
  }
}

function determineSystemStatus(
  brainHealth: { state: string; errorsCount: number },
  aiKeyStatus: { healthyKeys: number; totalKeys: number },
  violations: number
): "healthy" | "degraded" | "critical" {
  if (brainHealth.state === "SHUTDOWN" || aiKeyStatus.healthyKeys === 0) {
    return "critical";
  }

  if (
    brainHealth.errorsCount > 10 ||
    aiKeyStatus.healthyKeys < aiKeyStatus.totalKeys / 2 ||
    violations > 5
  ) {
    return "degraded";
  }

  return "healthy";
}
