import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { centralDataEngine } from "@/lib/server/central-data-engine";
import { apiKeyPoolManager } from "@/lib/server/api-key-pool-manager";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.userId!)
      .single();

    if (!profile?.is_admin) {
      return unauthorizedResponse();
    }

    try {
      const status = await centralDataEngine.getComprehensiveStatus();
      const architecture = await centralDataEngine.getDataFlowArchitecture();
      const poolStatus = await apiKeyPoolManager.getPoolAllocation();

      return successResponse({
        status,
        architecture,
        apiKeyPool: poolStatus,
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error("[SystemHealthAnalysis] Error:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.user!.id)
    .single();

  if (!profile?.is_admin) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "triggerDailySync": {
        const result = await centralDataEngine.triggerDailySync();
        return successResponse(result);
      }
      case "refreshAtmSubscriptions": {
        await centralDataEngine.refreshAtmSubscriptions();
        return successResponse({ success: true, message: "ATM subscriptions refreshed" });
      }
      case "initializeEngine": {
        await centralDataEngine.initialize();
        return successResponse({ success: true, message: "Central data engine initialized" });
      }
      default:
        return successResponse({ error: "Unknown action" });
    }
  } catch (error) {
    console.error("[SystemHealthAnalysis] POST Error:", error);
    return serverErrorResponse();
  }
}
