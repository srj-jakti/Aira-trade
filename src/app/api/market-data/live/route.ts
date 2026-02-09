import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { zerodhaService } from "@/lib/server/zerodha-service";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  }>,
  targetTimeframe: string
): Array<{
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  if (candles.length === 0) return [];

  const normalizedTf = normalizeTimeframe(targetTimeframe);
  
  if (normalizedTf !== "week" && normalizedTf !== "month") {
    return candles;
  }

  const bucketMap = new Map<string, {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>();

  for (const candle of candles) {
    let bucketKey: string;
    const d = new Date(candle.timestamp);
    
    if (normalizedTf === "week") {
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
    } else {
      let bucketDate: Date;
      if (normalizedTf === "week") {
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
      });
    }
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentToken = searchParams.get("instrument") || searchParams.get("instrumentToken");
  const rawTimeframe = searchParams.get("timeframe") || "5m";
  const timeframe = normalizeTimeframe(rawTimeframe);
  const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 5000);
  const beforeTimestamp = searchParams.get("before");

  if (!instrumentToken) {
    return badRequestResponse("instrument parameter is required");
  }

  try {
    const config = await zerodhaService.getActiveConfig();
    if (!config) {
      return successResponse({
        candles: [],
        latestTick: null,
        dataSource: "NO_CONNECTION",
        error: "No active Zerodha connection. Please login from Admin panel.",
        timeframe,
        count: 0,
        hasMore: false,
      });
    }

    const interval = getZerodhaInterval(rawTimeframe);
    const daysBack = getDaysBack(rawTimeframe);
    
    const now = new Date();
    let toDate = now;
    
    if (beforeTimestamp) {
      toDate = new Date(beforeTimestamp);
    }
    
    const fromDate = new Date(toDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = toDate.toISOString().split("T")[0];

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
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText || response.statusText };
      }
      
      console.error("[LiveRoute] Zerodha API error:", errorData);
      
      if (response.status === 403 || errorData.status === "error" && errorData.error_type === "TokenException") {
        if (config?.configId) {
          await supabaseAdmin
            .from("admin_zerodha_configs")
            .update({
              connection_status: "expired",
              token_expires_at: new Date(Date.now() - 1000).toISOString(),
              last_error: typeof errorData?.message === "string" ? errorData.message : "Token expired or invalid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", config.configId);
          zerodhaService.clearCache();
        }
        return successResponse({
          candles: [],
          latestTick: null,
          dataSource: "TOKEN_EXPIRED",
          error: "Zerodha token expired. Please re-login from Admin panel.",
          timeframe,
          count: 0,
          hasMore: false,
        });
      }
      
      // If instrument not found or other data error, return empty instead of 500
      if (response.status === 400 || response.status === 404) {
         return successResponse({
          candles: [],
          latestTick: null,
          dataSource: "NO_DATA",
          error: `Data not available for instrument ${instrumentToken}`,
          timeframe,
          count: 0,
          hasMore: false,
        });
      }

      return serverErrorResponse(`External API Error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    const rawCandles = data.data?.candles || [];

    let candles = rawCandles.map((c: (string | number)[]) => ({
      timestamp: new Date(c[0] as string),
      open: c[1] as number,
      high: c[2] as number,
      low: c[3] as number,
      close: c[4] as number,
      volume: c[5] as number,
    }));

    if (timeframe === "week" || timeframe === "month") {
      candles = aggregateToHigherTimeframe(candles, timeframe);
    }

    candles = candles.slice(-limit);

    let latestTick = null;
    try {
      const quoteResponse = await fetch(
        `https://api.kite.trade/quote?i=NSE:${instrumentToken}&i=NFO:${instrumentToken}`,
        {
          headers: {
            "X-Kite-Version": "3",
            Authorization: `token ${config.apiKey}:${config.accessToken}`,
          },
        }
      );

      if (quoteResponse.ok) {
        const quoteData = await quoteResponse.json();
        const quotes = quoteData.data || {};
        const quote = Object.values(quotes)[0] as {
          last_price?: number;
          volume?: number;
          change?: number;
          ohlc?: { close?: number };
        } | undefined;
        
        if (quote) {
          const prevClose = quote.ohlc?.close || 0;
          const change = quote.last_price ? quote.last_price - prevClose : 0;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
          
          latestTick = {
            price: quote.last_price,
            volume: quote.volume,
            timestamp: new Date().toISOString(),
            change,
            changePercent,
          };
        }
      }
    } catch (e) {
      console.error("[LiveRoute] Quote fetch error:", e);
    }

    return successResponse({ 
      candles: candles.map((c: { timestamp: Date; open: number; high: number; low: number; close: number; volume: number }) => ({
        timestamp: c.timestamp.toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
      latestTick,
      dataSource: "ZERODHA_REALTIME",
      timeframe,
      count: candles.length,
      hasMore: candles.length >= limit,
      oldestTimestamp: candles.length > 0 ? candles[0].timestamp.toISOString() : null,
      newestTimestamp: candles.length > 0 ? candles[candles.length - 1].timestamp.toISOString() : null,
    });
  } catch (error) {
    console.error("Error fetching live data:", error);
    return serverErrorResponse();
  }
}
