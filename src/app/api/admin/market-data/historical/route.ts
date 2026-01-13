import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/encryption";

export const maxDuration = 300;

const LIVE_HISTORICAL_RETENTION: Record<string, { days: number; zerodhaInterval: string }> = {
  "1m": { days: 5, zerodhaInterval: "minute" },
  "5m": { days: 5, zerodhaInterval: "5minute" },
  "15m": { days: 10, zerodhaInterval: "15minute" },
  "1h": { days: 30, zerodhaInterval: "60minute" },
};

async function fetchFromZerodha(
  apiKey: string,
  accessToken: string,
  instrumentToken: number,
  interval: string,
  from: Date,
  to: Date
) {
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];
  const url = `https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}?from=${fromStr}&to=${toStr}`;

  const response = await fetch(url, {
    headers: {
      "X-Kite-Version": "3",
      Authorization: `token ${apiKey}:${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.data?.candles || [];
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { instrumentToken, timeframe = "5m", days } = body;

    const { data: configs } = await supabaseAdmin
      .from("admin_zerodha_configs")
      .select("api_key, access_token")
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .limit(1);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ error: "No active Zerodha config" }, { status: 400 });
    }

    const apiKey = decrypt(configs[0].api_key);
    const accessToken = decrypt(configs[0].access_token);

    const retention = LIVE_HISTORICAL_RETENTION[timeframe];
    if (!retention) {
      return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 });
    }

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - (days || retention.days));

    let results: any[] = [];

    if (instrumentToken) {
      const candles = await fetchFromZerodha(apiKey, accessToken, instrumentToken, retention.zerodhaInterval, fromDate, toDate);
      
      const rows = candles.map((c: any[]) => ({
        instrument_token: instrumentToken,
        timeframe: timeframe,
        timestamp: new Date(c[0]).toISOString(),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
        oi: c[6] || 0,
      }));

      const { error } = await supabaseAdmin
        .from("live_candles")
        .upsert(rows, { onConflict: "instrument_token,timeframe,timestamp" });

      if (error) throw error;
      
      results.push({ instrumentToken, candlesInserted: rows.length });
    } else {
      const { data: instruments } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, tradingsymbol")
        .eq("is_subscribed", true)
        .in("subscription_priority", ["core", "high"])
        .limit(20);

      for (const inst of instruments || []) {
        try {
          const candles = await fetchFromZerodha(apiKey, accessToken, inst.instrument_token, retention.zerodhaInterval, fromDate, toDate);
          
          const rows = candles.map((c: any[]) => ({
            instrument_token: inst.instrument_token,
            timeframe: timeframe,
            timestamp: new Date(c[0]).toISOString(),
            open: c[1],
            high: c[2],
            low: c[3],
            close: c[4],
            volume: c[5],
            oi: c[6] || 0,
          }));

          if (rows.length > 0) {
            await supabaseAdmin
              .from("live_candles")
              .upsert(rows, { onConflict: "instrument_token,timeframe,timestamp" });
            
            results.push({ tradingsymbol: inst.tradingsymbol, candlesInserted: rows.length });
          }
          
          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          results.push({ tradingsymbol: inst.tradingsymbol, error: (err as Error).message });
        }
      }
    }

    return NextResponse.json({ success: true, results, fromDate: fromDate.toISOString(), toDate: toDate.toISOString() });
  } catch (error) {
    console.error("[Historical Backfill] Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    description: "Historical data backfill API",
    usage: "POST with Bearer token, optional body: { instrumentToken?, timeframe?, days? }"
  });
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    description: "Historical data backfill API",
    usage: "POST with Bearer token, optional body: { instrumentToken?, timeframe?, days? }"
  });
}
