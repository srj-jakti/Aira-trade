import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tokens, source = "on_demand" } = body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return NextResponse.json({ error: "tokens array is required" }, { status: 400 });
  }

  if (tokens.length > 50) {
    return NextResponse.json({ error: "Maximum 50 tokens per request" }, { status: 400 });
  }

  const subscriptionRequests = tokens.map((token: number) => ({
    instrument_token: token,
    tier: "TEMP",
    source: source,
    source_id: user.id,
  }));

  const { error: insertError } = await supabase
    .from("subscription_requests")
    .insert(subscriptionRequests);

  if (insertError) {
    console.error("[OnDemand] Failed to create subscription requests:", insertError.message);
  }

  const { data: instruments, error: instError } = await supabase
    .from("instruments")
    .select(`
      instrument_token,
      tradingsymbol,
      exchange,
      segment,
      instrument_type,
      name,
      lot_size,
      expiry,
      strike
    `)
    .in("instrument_token", tokens);

  if (instError) {
    return NextResponse.json({ error: instError.message }, { status: 500 });
  }

  const { data: latestPrices } = await supabase
    .from("realtime_ticks")
    .select("instrument_token, last_price, volume, change_percent, tick_timestamp")
    .in("instrument_token", tokens)
    .order("tick_timestamp", { ascending: false });

  const priceMap = new Map<number, { last_price: number; volume: number; change_percent: number; tick_timestamp: string }>();
  if (latestPrices) {
    for (const tick of latestPrices) {
      if (!priceMap.has(tick.instrument_token)) {
        priceMap.set(tick.instrument_token, {
          last_price: tick.last_price,
          volume: tick.volume,
          change_percent: tick.change_percent,
          tick_timestamp: tick.tick_timestamp,
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
    tier: "TEMP",
    message: "Subscriptions requested - data will be available shortly",
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const instrumentToken = parseInt(token);

  const { data: instrument } = await supabase
    .from("instruments")
    .select(`
      instrument_token,
      tradingsymbol,
      exchange,
      segment,
      instrument_type,
      name,
      lot_size,
      expiry,
      strike
    `)
    .eq("instrument_token", instrumentToken)
    .single();

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  const { data: tick } = await supabase
    .from("realtime_ticks")
    .select("*")
    .eq("instrument_token", instrumentToken)
    .order("tick_timestamp", { ascending: false })
    .limit(1)
    .single();

  await supabase
    .from("subscription_requests")
    .insert({
      instrument_token: instrumentToken,
      tier: "TEMP",
      source: "on_demand_get",
      source_id: user.id,
    });

  return NextResponse.json({
    instrument: {
      ...instrument,
      ...tick,
    },
    tier: "TEMP",
  });
}
