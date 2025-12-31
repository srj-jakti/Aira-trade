import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchHistoricalData, storeHistoricalCandles } from "@/lib/server/market-data-engine";

const DEFAULT_TIMEFRAMES = [
  { timeframe: "3m", durationMonths: 1 },
  { timeframe: "5m", durationMonths: 3 },
  { timeframe: "15m", durationMonths: 6 },
  { timeframe: "1h", durationMonths: 12 },
  { timeframe: "1d", durationMonths: 36 },
];

export async function POST(req: Request) {
  try {
    const { instrumentToken, autoSync } = await req.json();

    if (!instrumentToken) {
      return NextResponse.json({ error: "Instrument token is required" }, { status: 400 });
    }

    const results = [];

    // Process each default timeframe
    for (const config of DEFAULT_TIMEFRAMES) {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - config.durationMonths);

      try {
        const candles = await fetchHistoricalData(instrumentToken, config.timeframe, from, to);
        const count = await storeHistoricalCandles(instrumentToken, config.timeframe, candles);
        
        results.push({
          timeframe: config.timeframe,
          count,
          status: "success"
        });

        // Save sync config
        if (autoSync) {
          await supabaseAdmin.from("instrument_sync_configs").upsert({
            instrument_token: instrumentToken,
            timeframe: config.timeframe,
            enabled: true,
            last_updated_at: new Date().toISOString()
          }, { onConflict: "instrument_token,timeframe" });
        }
      } catch (err: any) {
        results.push({
          timeframe: config.timeframe,
          error: err.message,
          status: "error"
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Error downloading default historical data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
