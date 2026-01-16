import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { getCandles, validateCandleMode } from "@/lib/server/candle-service";
import { getLatestTick } from "@/lib/server/market-data-engine";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { zerodhaService } from "@/lib/server/zerodha-service";

function normalizeTimeframe(tf: string): string {
  const aliases: Record<string, string> = {
    "1d": "day",
    "day": "day",
    "D": "day",
    "1w": "week",
    "week": "week",
    "W": "week",
    "1M": "month",
    "month": "month",
  };
  return aliases[tf] || tf;
}

function getZerodhaInterval(timeframe: string): string {
  const normalizedTf = normalizeTimeframe(timeframe);
  const intervalMap: Record<string, string> = {
    "1s": "minute",
    "5s": "minute",
    "15s": "minute",
    "1m": "minute",
    "3m": "3minute",
    "5m": "5minute",
    "15m": "15minute",
    "30m": "30minute",
    "1h": "60minute",
    "day": "day",
    "week": "day",
    "month": "day",
  };
  return intervalMap[normalizedTf] || "5minute";
}

function getDaysBack(timeframe: string): number {
  const normalizedTf = normalizeTimeframe(timeframe);
  const daysBackMap: Record<string, number> = {
    "1m": 60,
    "3m": 100,
    "5m": 100,
    "15m": 200,
    "30m": 400,
    "1h": 400,
    "day": 2000,
    "week": 2000,
    "month": 2000,
  };
  return daysBackMap[normalizedTf] || 100;
}

function aggregateToHigherTimeframe(
  candles: Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi: number;
  }>,
  targetTimeframe: string
): Array<{
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}> {
  if (candles.length === 0) return [];

  const normalizedTf = normalizeTimeframe(targetTimeframe);
  
  if (normalizedTf !== "day" && normalizedTf !== "week" && normalizedTf !== "month") {
    return candles;
  }

  const bucketMap = new Map<string, {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi: number;
  }>();

  for (const candle of candles) {
    let bucketKey: string;
    const d = new Date(candle.timestamp);
    
    if (normalizedTf === "day") {
      bucketKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } else if (normalizedTf === "week") {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      bucketKey = `${startOfWeek.getFullYear()}-W${String(Math.ceil((startOfWeek.getDate()) / 7)).padStart(2, "0")}`;
    } else {
      bucketKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    const existing = bucketMap.get(bucketKey);
    if (existing) {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
      existing.volume += candle.volume;
      existing.oi = candle.oi || existing.oi;
    } else {
      let bucketDate: Date;
      if (normalizedTf === "day") {
        bucketDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      } else if (normalizedTf === "week") {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        bucketDate = startOfWeek;
      } else {
        bucketDate = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      
      bucketMap.set(bucketKey, {
        timestamp: bucketDate,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        oi: candle.oi,
      });
    }
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

async function fetchFromZerodhaAPI(
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
  try {
    const config = await zerodhaService.getActiveConfig();
    if (!config) {
      console.log("[LiveRoute] No active Zerodha config for historical fetch");
      return [];
    }

    const interval = getZerodhaInterval(timeframe);
    const daysBack = getDaysBack(timeframe);
    
    const now = new Date();
    const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = now.toISOString().split("T")[0];

    console.log(`[LiveRoute] Fetching from Zerodha: token=${instrumentToken} interval=${interval} timeframe=${timeframe} from=${fromStr} to=${toStr}`);

    const response = await fetch(
      `https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}?from=${fromStr}&to=${toStr}`,
      {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${config.apiKey}:${config.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error("[LiveRoute] Zerodha API error:", error);
      return [];
    }

    const data = await response.json();
    const rawCandles = data.data?.candles || [];

    console.log(`[LiveRoute] Got ${rawCandles.length} raw candles from Zerodha`);

    let candles = rawCandles.map((c: (string | number)[]) => ({
      timestamp: new Date(c[0] as string),
      open: c[1] as number,
      high: c[2] as number,
      low: c[3] as number,
      close: c[4] as number,
      volume: c[5] as number,
      oi: (c[6] as number) || 0,
    }));

    const normalizedTf = normalizeTimeframe(timeframe);
    if (normalizedTf === "week" || normalizedTf === "month") {
      candles = aggregateToHigherTimeframe(candles, timeframe);
      console.log(`[LiveRoute] Aggregated to ${candles.length} ${normalizedTf} candles`);
    }

    if (candles.length > 0) {
      const storeTf = normalizeTimeframe(timeframe);
      const rows = candles.map((c: { timestamp: Date; open: number; high: number; low: number; close: number; volume: number; oi: number }) => ({
        instrument_token: instrumentToken,
        timeframe: storeTf,
        timestamp: c.timestamp.toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        oi: c.oi,
      }));

      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await supabaseAdmin
          .from("live_candles")
          .upsert(batch, { onConflict: "instrument_token,timeframe,timestamp" });
      }
      console.log(`[LiveRoute] Stored ${rows.length} candles in live_candles with timeframe=${storeTf}`);
    }

    return candles.slice(-limit);
  } catch (error) {
    console.error("[LiveRoute] Error fetching from Zerodha:", error);
    return [];
  }
}

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
    .limit(10000);
  
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
  const instrumentToken = searchParams.get("instrument") || searchParams.get("instrumentToken");
  const rawTimeframe = searchParams.get("timeframe") || "5m";
  const timeframe = normalizeTimeframe(rawTimeframe);
  const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 5000);
  const beforeTimestamp = searchParams.get("before") || undefined;

  if (!instrumentToken) {
    return badRequestResponse("instrument parameter is required");
  }

  console.log(`[LiveRoute] Request: instrument=${instrumentToken} rawTf=${rawTimeframe} normalizedTf=${timeframe} limit=${limit}`);

  try {
    validateCandleMode("LIVE", "chart_api");

    const result = await getCandles({
      instrumentToken: parseInt(instrumentToken),
      timeframe,
      mode: "LIVE",
      limit,
      beforeTimestamp,
    });

    let dataSource = "LIVE";
    let candles = result.candles;
    let hasMore = result.hasMore;

    console.log(`[LiveRoute] Got ${candles.length} candles from live_candles for timeframe=${timeframe}`);

    if (candles.length < limit && !beforeTimestamp) {
      console.log(`[LiveRoute] Only ${candles.length} candles in live_candles, fetching from Zerodha...`);
      const zerodhaCandles = await fetchFromZerodhaAPI(
        parseInt(instrumentToken),
        rawTimeframe,
        limit
      );
      if (zerodhaCandles.length > candles.length) {
        candles = zerodhaCandles;
        dataSource = "ZERODHA_HISTORICAL";
        hasMore = zerodhaCandles.length >= limit;
      }
    }

    if (candles.length === 0 && !beforeTimestamp) {
      candles = await generateCandlesFromTicks(
        parseInt(instrumentToken),
        timeframe,
        limit
      );
      if (candles.length > 0) {
        dataSource = "LIVE_TICKS";
      }
    }

    if (candles.length === 0 && beforeTimestamp) {
      console.log(`[LiveRoute] No live candles before ${beforeTimestamp}, fetching runtime historical`);
      const runtimeResult = await getCandles({
        instrumentToken: parseInt(instrumentToken),
        timeframe,
        mode: "RUNTIME_HISTORICAL",
        limit,
        beforeTimestamp,
      });
      
      if (runtimeResult.candles.length > 0) {
        candles = runtimeResult.candles;
        dataSource = "RUNTIME_HISTORICAL";
        hasMore = runtimeResult.hasMore;
      }
    }

    const latestTick = await getLatestTick(parseInt(instrumentToken));

    console.log(`[LiveRoute] Returning ${candles.length} candles from ${dataSource}`);

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
      timeframe,
      count: candles.length,
      hasMore,
      oldestTimestamp: candles.length > 0 ? candles[0].timestamp.toISOString() : null,
      newestTimestamp: candles.length > 0 ? candles[candles.length - 1].timestamp.toISOString() : null,
      nextPage: hasMore ? (candles.length > 0 ? candles[0].timestamp.toISOString() : null) : null,
    });
  } catch (error) {
    console.error("Error fetching live data:", error);
    return serverErrorResponse();
  }
}
