import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { apiKeyPoolManager } from "@/lib/server/api-key-pool-manager";
import { decrypt } from "@/lib/server/encryption";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentToken = searchParams.get("instrument");
  const timeframe = searchParams.get("timeframe") || "1d";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!instrumentToken) {
    return badRequestResponse("instrument parameter is required");
  }

  try {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    let candles = await getHistoricalCandles(
      parseInt(instrumentToken),
      timeframe,
      fromDate,
      toDate
    );

    if (candles.length < 10) {
      try {
        const fetchedCandles = await fetchHistoricalData(
          parseInt(instrumentToken),
          timeframe,
          fromDate,
          toDate
        );
        
        if (fetchedCandles.length > 0) {
          storeHistoricalCandles(parseInt(instrumentToken), timeframe, fetchedCandles).catch(err => 
            console.error("Error storing historical candles:", err)
          );
          
          candles = fetchedCandles.map(c => ({
            timestamp: c.timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            oi: c.oi || 0
          }));
        }
      } catch (zerodhaError) {
        console.warn("Could not fetch from Zerodha:", zerodhaError);
      }
    }

    return successResponse({ 
      candles,
      dataSource: "BACKTEST",
      warning: "This endpoint returns historical data for BACKTESTING only. For live analysis, use /api/market-data/live"
    });
  } catch (error) {
    console.error("[HistoricalAPI] Error:", error);
    return serverErrorResponse();
  }
}
