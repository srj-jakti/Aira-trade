import { NextRequest, NextResponse } from "next/server";
import { userZerodhaService } from "@/lib/server/user-zerodha-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("[Cron: Refresh User Tokens] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron: Refresh User Tokens] Starting user token refresh...");

    const result = await userZerodhaService.refreshExpiredUserTokens();

    console.log(`[Cron: Refresh User Tokens] Complete: ${result.success} success, ${result.failed} failed`);

    return NextResponse.json({
      success: true,
      refreshed: result.success,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron: Refresh User Tokens] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to refresh user tokens",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
