import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  let query = supabase
    .from("scanner_instruments")
    .select(`
      instrument_token,
      tradingsymbol,
      exchange,
      segment,
      instrument_type,
      name,
      lot_size,
      expiry,
      strike,
      category,
      is_active
    `)
    .eq("is_active", true);

  if (category) {
    query = query.eq("category", category);
  }

  const { data: instruments, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tokens = instruments?.map((i: { instrument_token: number }) => i.instrument_token) || [];

  const { data: latestPrices } = await supabase
    .from("realtime_ticks")
    .select("instrument_token, last_price, volume, change_percent, tick_timestamp")
    .in("instrument_token", tokens.slice(0, 100))
    .order("tick_timestamp", { ascending: false });

  const priceMap = new Map<number, { last_price: number; volume: number; change_percent: number }>();
  if (latestPrices) {
    for (const tick of latestPrices) {
      if (!priceMap.has(tick.instrument_token)) {
        priceMap.set(tick.instrument_token, {
          last_price: tick.last_price,
          volume: tick.volume,
          change_percent: tick.change_percent,
        });
      }
    }
  }

  const enrichedInstruments = instruments?.map((inst: { instrument_token: number }) => ({
    ...inst,
    ...priceMap.get(inst.instrument_token),
  }));

  return NextResponse.json({
    instruments: enrichedInstruments,
    count: enrichedInstruments?.length || 0,
    tier: "SCANNER",
  });
}
