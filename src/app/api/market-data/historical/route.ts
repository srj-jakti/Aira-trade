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

      // Check if data is stale (latest candle is more than 1 day old for intraday, or missing recent data)
      const isStale = () => {
        if (candles.length < 10) return true;
        const latestCandle = candles[candles.length - 1];
        if (!latestCandle) return true;
        
        const latestTime = new Date(latestCandle.timestamp).getTime();
        const now = Date.now();
        
        // For intraday timeframes, check if data is more than 1 trading day old
        if (["1m", "3m", "5m", "10m", "15m", "30m", "1h"].includes(timeframe)) {
          const oneDayAgo = now - (24 * 60 * 60 * 1000);
          return latestTime < oneDayAgo;
        }
        
        // For daily/weekly, check if data is more than 2 days old
        const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
        return latestTime < twoDaysAgo;
      };

      // If no candles, too few, or stale data - fetch from Zerodha
      if (isStale()) {
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
