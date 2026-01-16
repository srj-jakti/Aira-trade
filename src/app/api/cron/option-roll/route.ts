import { NextRequest } from "next/server";
import { serverErrorResponse, successResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface OptionRollConfig {
  id: string;
  underlying_symbol: string;
  underlying_token: number;
  exchange: string;
  strike_range: number;
  include_weekly: boolean;
  include_monthly: boolean;
  include_next_expiry: boolean;
  option_types: string[];
  is_active: boolean;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const errors: string[] = [];
    let rolled = 0;

    const { data: configs, error: configError } = await supabaseAdmin
      .from("option_roll_config")
      .select("*")
      .eq("is_active", true);

    if (configError) {
      console.error("[OptionRoll] Failed to fetch configs:", configError.message);
      return successResponse({ success: false, rolled: 0, errors: [configError.message] });
    }

    if (!configs || configs.length === 0) {
      return successResponse({ success: true, rolled: 0, message: "No active option roll configs found" });
    }

    for (const config of configs as OptionRollConfig[]) {
      try {
        const result = await rollOptionsForUnderlying(config);
        rolled += result.count;
        if (result.error) errors.push(result.error);
      } catch (err) {
        const errorMsg = `Failed to roll options for ${config.underlying_symbol}: ${err}`;
        console.error("[OptionRoll]", errorMsg);
        errors.push(errorMsg);
      }
    }

    await supabaseAdmin.from("system_health_logs").insert({
      metric_type: "option_roll",
      metric_value: { rolled, errors },
      severity: errors.length === 0 ? "info" : "warning",
      message: `Option Roll: ${rolled} instruments rolled${errors.length > 0 ? `, ${errors.length} errors` : ""}`,
    });

    return successResponse({
      success: errors.length === 0,
      rolled,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[OptionRoll] Error:", error);
    await supabaseAdmin.from("system_health_logs").insert({
      metric_type: "option_roll_error",
      metric_value: { error: String(error) },
      severity: "error",
      message: `Option Roll failed: ${error}`,
    });
    return serverErrorResponse();
  }
}

async function rollOptionsForUnderlying(config: OptionRollConfig): Promise<{ count: number; error?: string }> {
  console.log(`[OptionRoll] Rolling options for ${config.underlying_symbol}...`);

  const underlyingPrice = await getUnderlyingPrice(config.underlying_token);
  if (!underlyingPrice) {
    return { count: 0, error: `Could not get price for ${config.underlying_symbol}` };
  }

  const atmStrike = calculateATMStrike(underlyingPrice, config.underlying_symbol);
  const strikesNeeded = generateStrikesAround(atmStrike, config.strike_range, config.underlying_symbol);

  const expiries = await getActiveExpiries(config);
  if (expiries.length === 0) {
    return { count: 0, error: `No active expiries found for ${config.underlying_symbol}` };
  }

  const { data: existingOptions } = await supabaseAdmin
    .from("scanner_instruments")
    .select("instrument_token")
    .eq("category", `OPTION_${config.underlying_symbol}`);

  const existingTokens = new Set((existingOptions || []).map((o: { instrument_token: number }) => o.instrument_token));

  const optionsToAdd: Record<string, unknown>[] = [];

  for (const expiry of expiries) {
    for (const strike of strikesNeeded) {
      for (const optionType of config.option_types) {
        const { data: option } = await supabaseAdmin
          .from("instruments")
          .select("*")
          .eq("exchange", config.exchange)
          .eq("strike", strike)
          .eq("expiry", expiry)
          .eq("instrument_type", optionType)
          .ilike("tradingsymbol", `${config.underlying_symbol}%`)
          .single();

        if (option && !existingTokens.has(option.instrument_token)) {
          optionsToAdd.push({
            instrument_token: option.instrument_token,
            tradingsymbol: option.tradingsymbol,
            exchange: option.exchange,
            segment: option.segment,
            instrument_type: option.instrument_type,
            name: option.name,
            lot_size: option.lot_size,
            expiry: option.expiry,
            strike: option.strike,
            is_auto_updated: true,
            auto_update_config: { underlying: config.underlying_symbol, atm_strike: atmStrike },
            is_active: true,
            category: `OPTION_${config.underlying_symbol}`,
          });
        }
      }
    }
  }

  if (optionsToAdd.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("scanner_instruments")
      .upsert(optionsToAdd, { onConflict: "instrument_token" });

    if (insertError) {
      return { count: 0, error: `Failed to add options: ${insertError.message}` };
    }
  }

  await removeExpiredOptions(config.underlying_symbol);

  await supabaseAdmin
    .from("option_roll_config")
    .update({
      last_roll_at: new Date().toISOString(),
      last_roll_status: "success",
      last_roll_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", config.id);

  return { count: optionsToAdd.length };
}

async function getUnderlyingPrice(token: number): Promise<number | null> {
  const { data: tick } = await supabaseAdmin
    .from("realtime_ticks")
    .select("last_price")
    .eq("instrument_token", token)
    .order("tick_timestamp", { ascending: false })
    .limit(1)
    .single();

  if (tick) return tick.last_price;

  const { data: candle } = await supabaseAdmin
    .from("live_candles")
    .select("close")
    .eq("instrument_token", token)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  return candle?.close || null;
}

function calculateATMStrike(price: number, underlying: string): number {
  const strikeGap = underlying === "BANKNIFTY" ? 100 : underlying === "FINNIFTY" ? 50 : 50;
  return Math.round(price / strikeGap) * strikeGap;
}

function generateStrikesAround(atmStrike: number, range: number, underlying: string): number[] {
  const strikeGap = underlying === "BANKNIFTY" ? 100 : underlying === "FINNIFTY" ? 50 : 50;
  const strikes: number[] = [];

  for (let i = -range; i <= range; i++) {
    strikes.push(atmStrike + i * strikeGap);
  }

  return strikes;
}

async function getActiveExpiries(config: OptionRollConfig): Promise<string[]> {
  const today = new Date();
  const expiries: string[] = [];

  const { data: allExpiries } = await supabaseAdmin
    .from("instruments")
    .select("expiry")
    .eq("exchange", config.exchange)
    .ilike("tradingsymbol", `${config.underlying_symbol}%`)
    .in("instrument_type", config.option_types)
    .gte("expiry", today.toISOString().split("T")[0])
    .order("expiry", { ascending: true });

  if (!allExpiries || allExpiries.length === 0) return [];

  const uniqueExpiries = [...new Set(allExpiries.map((e: { expiry: string }) => e.expiry))];

  if (config.include_weekly && uniqueExpiries.length > 0) {
    expiries.push(uniqueExpiries[0]);
  }

  if (config.include_next_expiry && uniqueExpiries.length > 1) {
    expiries.push(uniqueExpiries[1]);
  }

  if (config.include_monthly) {
    const monthlyExpiry = uniqueExpiries.find((exp: string) => {
      const date = new Date(exp);
      const lastThursday = getLastThursday(date.getFullYear(), date.getMonth());
      return date.toDateString() === lastThursday.toDateString();
    });
    if (monthlyExpiry && !expiries.includes(monthlyExpiry)) {
      expiries.push(monthlyExpiry);
    }
  }

  return expiries;
}

function getLastThursday(year: number, month: number): Date {
  const date = new Date(year, month + 1, 0);
  while (date.getDay() !== 4) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

async function removeExpiredOptions(underlying: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const { data: expired } = await supabaseAdmin
    .from("scanner_instruments")
    .select("instrument_token")
    .eq("category", `OPTION_${underlying}`)
    .lt("expiry", today);

  if (expired && expired.length > 0) {
    const tokens = expired.map((e: { instrument_token: number }) => e.instrument_token);

    await supabaseAdmin
      .from("scanner_instruments")
      .delete()
      .in("instrument_token", tokens);

    await supabaseAdmin
      .from("instrument_subscriptions")
      .delete()
      .in("instrument_token", tokens);

    console.log(`[OptionRoll] Removed ${tokens.length} expired options for ${underlying}`);
  }
}
