import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { refreshDynamicSubscriptions, getSubscriptionStats } from "@/lib/server/dynamic-instrument-manager";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting dynamic instrument subscription refresh...");

    const result = await refreshDynamicSubscriptions();

    console.log(`[Cron] Subscription refresh complete:`, result);

    return successResponse({
      success: result.success,
      stats: result.stats,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Error refreshing subscriptions:", error);
    return serverErrorResponse();
  }
}

export async function GET() {
  try {
    const stats = await getSubscriptionStats();
    return successResponse({
      status: "ok",
      description: "Dynamic instrument subscription cron endpoint",
      usage: "POST with Bearer token authorization to refresh subscriptions",
      currentStats: stats,
    });
  } catch (error) {
    return successResponse({
      status: "ok",
      description: "Dynamic instrument subscription cron endpoint",
      usage: "POST with Bearer token authorization to refresh subscriptions",
    });
  }
}
