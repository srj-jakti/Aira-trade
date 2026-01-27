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

    const { data: cachedCandles } = await supabaseAdmin
      .from("historical_candles")
      .select("*")
      .eq("instrument_token", parseInt(instrumentToken))
      .eq("timeframe", timeframe)
      .gte("timestamp", fromDate.toISOString())
      .lte("timestamp", toDate.toISOString())
      .order("timestamp", { ascending: true });

    if (cachedCandles && cachedCandles.length >= 10) {
      return successResponse({
        candles: cachedCandles.map(c => ({
          timestamp: new Date(c.timestamp),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: parseInt(c.volume),
          oi: parseInt(c.oi) || 0,
        })),
        dataSource: "CACHE",
        message: "Data from historical cache",
      });
    }

    const analysisKey = await apiKeyPoolManager.getKeyForAnalysis();
    if (!analysisKey || !analysisKey.access_token) {
      return serverErrorResponse("No analysis API key available");
    }

    const apiKey = decrypt(analysisKey.api_key);
    const accessToken = decrypt(analysisKey.access_token);

    const intervalMap: Record<string, string> = {
      "1m": "minute",
      "3m": "3minute",
      "5m": "5minute",
      "10m": "10minute",
      "15m": "15minute",
      "30m": "30minute",
      "1h": "60minute",
      "1d": "day",
    };

    const interval = intervalMap[timeframe] || "day";
    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = toDate.toISOString().split("T")[0];

    const response = await fetch(
      `https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}?from=${fromStr}&to=${toStr}`,
      {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("[HistoricalAPI] Zerodha error:", error);
      return serverErrorResponse(error.message || "Failed to fetch data from Zerodha");
    }

    const data = await response.json();
    const candles = (data.data?.candles || []).map((c: (string | number)[]) => ({
      timestamp: new Date(c[0] as string),
      open: c[1] as number,
      high: c[2] as number,
      low: c[3] as number,
      close: c[4] as number,
      volume: c[5] as number,
      oi: (c[6] as number) || 0,
    }));

    if (candles.length > 0) {
      const rows = candles.map((c: { timestamp: Date; open: number; high: number; low: number; close: number; volume: number; oi: number }) => ({
        instrument_token: parseInt(instrumentToken),
        timeframe,
        timestamp: c.timestamp.toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        oi: c.oi,
      }));

      (async () => {
        try {
          const { error } = await supabaseAdmin
            .from("historical_candles")
            .upsert(rows, { onConflict: "instrument_token,timeframe,timestamp" });
          if (!error) console.log(`[HistoricalAPI] Cached ${rows.length} candles`);
          else console.error("[HistoricalAPI] Cache error:", error);
        } catch (e) {
          console.error("[HistoricalAPI] Cache error:", e);
        }
      })();
    }

    return successResponse({
      candles,
      dataSource: "ZERODHA_API",
      apiKeyUsed: analysisKey.name,
      message: "Fresh data from Zerodha API (dedicated analysis key)",
    });
  } catch (error) {
    console.error("[HistoricalAPI] Error:", error);
    return serverErrorResponse();
  }
}
