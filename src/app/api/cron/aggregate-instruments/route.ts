import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

async function runAggregation() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: activeStrategies, error: stratError } = await supabase
    .from("strategies")
    .select("id, name, selected_instruments, user_id")
    .eq("is_active", true)
    .eq("admin_approved", true);

  if (stratError) {
    throw new Error(stratError.message);
  }

  if (!activeStrategies || activeStrategies.length === 0) {
    return { message: "No active strategies", aggregated: 0 };
  }

  const instrumentsToAdd: Array<{
    instrument_token: number;
    tradingsymbol: string;
    exchange: string;
    instrument_type: string;
    source_type: string;
    source_id: string;
    user_id: string;
    is_active: boolean;
    priority: number;
    candle_depth: number;
  }> = [];

  for (const strategy of activeStrategies) {
    const instruments = strategy.selected_instruments || [];

    for (const inst of instruments) {
      if (!inst.instrument_token) continue;

      instrumentsToAdd.push({
        instrument_token: inst.instrument_token,
        tradingsymbol: inst.tradingsymbol || inst.symbol || "UNKNOWN",
        exchange: inst.exchange || "NSE",
        instrument_type: inst.instrument_type || "EQ",
        source_type: "STRATEGY",
        source_id: String(strategy.id),
        user_id: strategy.user_id,
        is_active: true,
        priority: 1,
        candle_depth: 50,
      });
    }
  }

  if (instrumentsToAdd.length === 0) {
    return { message: "No instruments found in strategies", aggregated: 0 };
  }

  const { error: upsertError } = await supabase
    .from("active_trade_instruments")
    .upsert(instrumentsToAdd, { onConflict: "instrument_token,source_type,source_id" });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { data: inactiveStrategies } = await supabase
    .from("strategies")
    .select("id")
    .or("is_active.eq.false,admin_approved.eq.false");

  if (inactiveStrategies && inactiveStrategies.length > 0) {
    const inactiveIds = inactiveStrategies.map((s: { id: number }) => String(s.id));

    await supabase
      .from("active_trade_instruments")
      .update({ is_active: false })
      .eq("source_type", "STRATEGY")
      .in("source_id", inactiveIds);
  }

  return {
    message: "Instrument aggregation complete",
    aggregated: instrumentsToAdd.length,
    strategies: activeStrategies.length,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAggregation();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[AggregateInstruments] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || !serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAggregation();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[AggregateInstruments] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
