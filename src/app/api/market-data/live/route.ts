import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { getLiveCandles, getLatestTick } from "@/lib/server/market-data-engine";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentToken = searchParams.get("instrument");
  const timeframe = searchParams.get("timeframe") || "5m";
  const limit = parseInt(searchParams.get("limit") || "200");

  if (!instrumentToken) {
    return badRequestResponse("instrument parameter is required");
  }

  try {
    const candles = await getLiveCandles(
      parseInt(instrumentToken),
      timeframe,
      limit
    );

    const latestTick = await getLatestTick(parseInt(instrumentToken));

    return successResponse({ 
      candles,
      latestTick: latestTick ? {
        price: latestTick.lastPrice,
        volume: latestTick.volume,
        timestamp: latestTick.timestamp,
        change: latestTick.change,
        changePercent: latestTick.changePercent,
      } : null,
      dataSource: "LIVE",
      count: candles.length,
    });
  } catch (error) {
    console.error("Error fetching live data:", error);
    return serverErrorResponse();
  }
}
