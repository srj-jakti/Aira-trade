import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { zerodhaService } from "@/lib/server/zerodha-service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface QuoteData {
  instrument_token: number;
  last_price: number;
  ohlc: { open: number; high: number; low: number; close: number };
  volume: number;
  oi?: number;
  change?: number;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await zerodhaService.getActiveConfig();
    if (!config) {
      console.log("[MarketPoll] No active Zerodha config, skipping poll");
      return successResponse({ success: false, error: "No active Zerodha connection" });
    }

    const { data: instruments } = await supabaseAdmin
      .from("scanner_instruments")
      .select("instrument_token")
      .eq("is_active", true)
      .limit(200);

    const { data: strategyInstruments } = await supabaseAdmin
      .from("active_trade_instruments")
      .select("instrument_token")
      .eq("is_active", true)
      .limit(100);

    const allTokens = new Set<number>();
    
    allTokens.add(256265);
    allTokens.add(260105);
    allTokens.add(257801);
    
    (instruments || []).forEach((i: { instrument_token: number }) => allTokens.add(i.instrument_token));
    (strategyInstruments || []).forEach((i: { instrument_token: number }) => allTokens.add(i.instrument_token));

    const tokenArray = Array.from(allTokens);
    
    if (tokenArray.length === 0) {
      return successResponse({ success: true, message: "No instruments to poll" });
    }

    const tokenParam = tokenArray.map(t => `NFO:${t}`).join(",").substring(0, 3000);
    
    const response = await fetch(
      `https://api.kite.trade/quote?i=${encodeURIComponent(tokenParam)}`,
      {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${config.apiKey}:${config.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error("[MarketPoll] Zerodha quote error:", error);
      
      if (response.status === 403) {
        return successResponse({ success: false, error: "Token expired - needs re-login" });
      }
      return successResponse({ success: false, error: error.message });
    }

    const data = await response.json();
    const quotes = data.data || {};
    
    const ticks: Array<{
      instrument_token: number;
      last_price: number;
      volume: number | null;
      open: number | null;
      high: number | null;
      low: number | null;
      close: number | null;
      change: number | null;
      oi: number | null;
      tick_timestamp: string;
    }> = [];

    const candles: Array<{
      instrument_token: number;
      timeframe: string;
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      oi: number;
    }> = [];

    const now = new Date();
    const candleTimestamp = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();

    for (const [key, quote] of Object.entries(quotes)) {
      const q = quote as QuoteData;
      const token = q.instrument_token;

      ticks.push({
        instrument_token: token,
        last_price: q.last_price,
        volume: q.volume || null,
        open: q.ohlc?.open || null,
        high: q.ohlc?.high || null,
        low: q.ohlc?.low || null,
        close: q.ohlc?.close || null,
        change: q.change || null,
        oi: q.oi || null,
        tick_timestamp: now.toISOString(),
      });

      candles.push({
        instrument_token: token,
        timeframe: "1m",
        timestamp: candleTimestamp,
        open: q.ohlc?.open || q.last_price,
        high: Math.max(q.ohlc?.high || 0, q.last_price),
        low: Math.min(q.ohlc?.low || Infinity, q.last_price),
        close: q.last_price,
        volume: q.volume || 0,
        oi: q.oi || 0,
      });
    }

    if (ticks.length > 0) {
      await supabaseAdmin.from("realtime_ticks").insert(ticks);
    }

    if (candles.length > 0) {
      await supabaseAdmin
        .from("live_candles")
        .upsert(candles, { onConflict: "instrument_token,timeframe,timestamp" });
    }

    console.log(`[MarketPoll] Polled ${ticks.length} instruments`);

    return successResponse({
      success: true,
      polled: ticks.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[MarketPoll] Error:", error);
    return serverErrorResponse();
  }
}
