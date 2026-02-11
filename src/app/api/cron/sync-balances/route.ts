import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds timeout

export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if market is open (9:15 AM - 3:30 PM IST)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM

    if (currentMinutes < marketOpen || currentMinutes > marketClose) {
      return Response.json({
        success: true,
        message: "Market closed, skipping balance sync",
        timestamp: new Date().toISOString(),
      });
    }

    console.log("[CRON] Starting balance sync...");

    // Get all connected broker accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("user_broker_accounts")
      .select("user_id, broker, access_token, token_expires_at, is_connected")
      .eq("is_connected", true)
      .eq("is_active", true);

    if (accountsError) {
      console.error("[CRON] Error fetching accounts:", accountsError);
      return Response.json(
        {
          success: false,
          error: accountsError.message,
        },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      return Response.json({
        success: true,
        message: "No connected accounts to sync",
        timestamp: new Date().toISOString(),
      });
    }

    let synced = 0;
    let failed = 0;

    // Sync balance for each user
    for (const account of accounts) {
      try {
        // Check if token is expired
        if (
          account.token_expires_at &&
          new Date(account.token_expires_at) < new Date()
        ) {
          console.log(`[CRON] Token expired for user ${account.user_id}`);
          failed++;
          continue;
        }

        // For Zerodha, fetch balance using KiteConnect
        if (account.broker === "zerodha" && account.access_token) {
          // Note: This is a placeholder. Actual implementation would use KiteConnect SDK
          // const KiteConnect = require("kiteconnect").KiteConnect;
          // const kc = new KiteConnect({ api_key: API_KEY });
          // kc.setAccessToken(account.access_token);
          // const margins = await kc.getMargins();
          // const availableBalance = margins.equity.available.cash;

          // For now, we'll skip actual API call and just log
          console.log(`[CRON] Would sync balance for user ${account.user_id}`);
          synced++;

          // Update trading_preferences with balance
          // await supabaseAdmin
          //   .from("trading_preferences")
          //   .update({
          //     available_balance: availableBalance,
          //     updated_at: new Date().toISOString(),
          //   })
          //   .eq("user_id", account.user_id);
        }
      } catch (error) {
        console.error(
          `[CRON] Error syncing balance for user ${account.user_id}:`,
          error
        );
        failed++;
      }
    }

    console.log(
      `[CRON] Balance sync complete: ${synced} synced, ${failed} failed`
    );

    return Response.json({
      success: true,
      message: "Balance sync complete",
      synced,
      failed,
      total: accounts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Fatal error in balance sync:", error);
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
