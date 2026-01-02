import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { getLiveCandles, getLatestTick } from "@/lib/server/market-data-engine";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function generateCandlesFromTicks(
  instrumentToken: number,
  timeframe: string,
  limit: number
): Promise<Array<{
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}>> {
  const timeframeSeconds: Record<string, number> = {
    "1s": 1, "5s": 5, "15s": 15, "1m": 60, "5m": 300, "15m": 900, "1h": 3600
  };
  
  const seconds = timeframeSeconds[timeframe] || 60;
  const lookbackMs = seconds * 1000 * limit;
  const since = new Date(Date.now() - lookbackMs);
  
  const { data: ticks, error } = await supabaseAdmin
    .from("realtime_ticks")
    .select("last_price, volume, oi, tick_timestamp")
    .eq("instrument_token", instrumentToken)
    .gte("tick_timestamp", since.toISOString())
    .order("tick_timestamp", { ascending: true })
    .limit(5000);
  
  if (error || !ticks || ticks.length === 0) {
    return [];
  }
  
  const candleMap = new Map<number, {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi: number;
  }>();
  
  for (const tick of ticks) {
    const tickTime = new Date(tick.tick_timestamp).getTime();
    const bucketStart = Math.floor(tickTime / (seconds * 1000)) * (seconds * 1000);
    
    const existing = candleMap.get(bucketStart);
    const price = parseFloat(tick.last_price);
    const volume = parseInt(tick.volume) || 0;
    const oi = parseInt(tick.oi) || 0;
    
    if (existing) {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
      existing.volume = volume;
      existing.oi = oi;
    } else {
      candleMap.set(bucketStart, {
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
        oi,
      });
    }
  }
  
  const candles = Array.from(candleMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-limit)
    .map(([timestamp, candle]) => ({
      timestamp: new Date(timestamp),
      ...candle,
    }));
  
  return candles;
}

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
    let candles = await getLiveCandles(
      parseInt(instrumentToken),
      timeframe,
      limit
    );

    let dataSource = "LIVE";

    if (candles.length === 0) {
      candles = await generateCandlesFromTicks(
        parseInt(instrumentToken),
        timeframe,
        limit
      );
      dataSource = "LIVE_GENERATED";
    }

    const latestTick = await getLatestTick(parseInt(instrumentToken));

    return successResponse({ 
      candles: candles.map(c => ({
        timestamp: c.timestamp.toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
      latestTick: latestTick ? {
        price: latestTick.lastPrice,
        volume: latestTick.volume,
        timestamp: latestTick.timestamp,
        change: latestTick.change,
        changePercent: latestTick.changePercent,
      } : null,
      dataSource,
      count: candles.length,
    });
  } catch (error) {
    console.error("Error fetching live data:", error);
    return serverErrorResponse();
  }
}
