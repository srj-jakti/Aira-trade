import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { dailySyncManager } from "@/lib/server/daily-instrument-sync";
import { atmStrikeManager } from "@/lib/server/atm-strike-manager";
import { activeTradeManager } from "@/lib/server/active-trade-subscription-manager";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "full";

    console.log(`[Cron] Starting subscription refresh (action: ${action})...`);

    let result: { success: boolean; message: string; stats?: unknown } = { 
      success: true, 
      message: "" 
    };

    switch (action) {
      case "daily_sync": {
        const syncResult = await dailySyncManager.performDailySync();
        result = {
          success: syncResult.success,
          message: syncResult.message,
          stats: syncResult.stats,
        };
        break;
      }
      case "atm_refresh": {
        await atmStrikeManager.forceRefresh();
        result = {
          success: true,
          message: "ATM subscriptions refreshed for all indices",
        };
        break;
      }
      case "trade_sync": {
        await activeTradeManager.syncActiveTradeSubscriptions();
        const tradeStats = await activeTradeManager.getActiveTradeStats();
        result = {
          success: true,
          message: "Active trade subscriptions synced",
          stats: tradeStats,
        };
        break;
      }
      case "full":
      default: {
        const syncResult = await dailySyncManager.performDailySync();
        await atmStrikeManager.forceRefresh();
        await activeTradeManager.syncActiveTradeSubscriptions();
        
        result = {
          success: syncResult.success,
          message: `Full refresh: ${syncResult.message}`,
          stats: syncResult.stats,
        };
        break;
      }
    }

    console.log(`[Cron] Subscription refresh complete:`, result);

    return successResponse({
      ...result,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Error refreshing subscriptions:", error);
    return serverErrorResponse();
  }
}

export async function GET() {
  try {
    const syncStatus = await dailySyncManager.getSyncStatus();
    const atmTrackers = await atmStrikeManager.getTrackerStatus();
    const tradeStats = await activeTradeManager.getActiveTradeStats();

    return successResponse({
      status: "ok",
      description: "Central data engine subscription cron endpoint",
      actions: {
        "?action=daily_sync": "Full instrument sync + expiry cleanup",
        "?action=atm_refresh": "Refresh ATM option chain subscriptions",
        "?action=trade_sync": "Sync active trade subscriptions",
        "?action=full": "All of the above (default)",
      },
      currentStats: {
        dailySync: syncStatus,
        atmTracking: {
          indicesTracked: atmTrackers.length,
          trackers: atmTrackers.map(t => ({
            index: t.indexName,
            currentPrice: t.currentPrice,
            atmStrike: t.currentAtmStrike,
            subscribedStrikes: t.subscribedStrikes.length,
          })),
        },
        activeTrades: tradeStats,
      },
    });
  } catch (error) {
    return successResponse({
      status: "ok",
      description: "Central data engine subscription cron endpoint",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
