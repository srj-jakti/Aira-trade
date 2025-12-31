import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { getHistoricalCandles, fetchHistoricalData, storeHistoricalCandles } from "@/lib/server/market-data-engine";

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

    // Try to get from database first
    let candles = await getHistoricalCandles(
      parseInt(instrumentToken),
      timeframe,
      fromDate,
      toDate
    );

    // If no candles found or too few, try to fetch from Zerodha
    if (candles.length < 10) {
      try {
        const fetchedCandles = await fetchHistoricalData(
          parseInt(instrumentToken),
          timeframe,
          fromDate,
          toDate
        );
        
        if (fetchedCandles.length > 0) {
          // Store in background
          storeHistoricalCandles(parseInt(instrumentToken), timeframe, fetchedCandles).catch(err => 
            console.error("Error storing historical candles:", err)
          );
          
          // Return the fetched candles
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
        console.warn("Could not fetch from Zerodha, returning DB data (if any):", zerodhaError);
      }
    }

    return successResponse({ candles });
  } catch (error) {
    console.error("Error fetching historical data:", error);
    return serverErrorResponse();
  }
}
