import { SupabaseClient } from "@supabase/supabase-js";

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

interface Instrument {
  instrument_token: number;
  tradingsymbol: string;
  exchange: string;
  segment: string;
  instrument_type: string;
  strike: number;
  expiry: string;
  lot_size: number;
  name: string;
}

export class OptionRollService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async rollOptions(): Promise<{ success: boolean; rolled: number; errors: string[] }> {
    console.log("[OptionRoll] Starting daily option roll...");
    const errors: string[] = [];
    let rolled = 0;

    const { data: configs, error: configError } = await this.supabase
      .from("option_roll_config")
      .select("*")
      .eq("is_active", true);

    if (configError) {
      console.error("[OptionRoll] Failed to fetch configs:", configError.message);
      return { success: false, rolled: 0, errors: [configError.message] };
    }

    if (!configs || configs.length === 0) {
      console.log("[OptionRoll] No active option roll configs found");
      return { success: true, rolled: 0, errors: [] };
    }

    for (const config of configs as OptionRollConfig[]) {
      try {
        const result = await this.rollOptionsForUnderlying(config);
        rolled += result.count;
        if (result.error) errors.push(result.error);
      } catch (err) {
        const errorMsg = `Failed to roll options for ${config.underlying_symbol}: ${err}`;
        console.error("[OptionRoll]", errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`[OptionRoll] Roll complete. Rolled: ${rolled}, Errors: ${errors.length}`);
    return { success: errors.length === 0, rolled, errors };
  }

  private async rollOptionsForUnderlying(config: OptionRollConfig): Promise<{ count: number; error?: string }> {
    console.log(`[OptionRoll] Rolling options for ${config.underlying_symbol}...`);

    const underlyingPrice = await this.getUnderlyingPrice(config.underlying_token);
    if (!underlyingPrice) {
      return { count: 0, error: `Could not get price for ${config.underlying_symbol}` };
    }

    console.log(`[OptionRoll] ${config.underlying_symbol} price: ${underlyingPrice}`);

    const atmStrike = this.calculateATMStrike(underlyingPrice, config.underlying_symbol);
    const strikeRange = config.strike_range;
    const strikesNeeded = this.generateStrikesAround(atmStrike, strikeRange, config.underlying_symbol);

    console.log(`[OptionRoll] ATM Strike: ${atmStrike}, Strikes needed: ${strikesNeeded.join(", ")}`);

    const expiries = await this.getActiveExpiries(config);
    if (expiries.length === 0) {
      return { count: 0, error: `No active expiries found for ${config.underlying_symbol}` };
    }

    console.log(`[OptionRoll] Active expiries: ${expiries.join(", ")}`);

    const { data: existingOptions, error: existingError } = await this.supabase
      .from("scanner_instruments")
      .select("instrument_token")
      .eq("category", `OPTION_${config.underlying_symbol}`);

    if (existingError) {
      console.error("[OptionRoll] Error fetching existing options:", existingError.message);
    }

    const existingTokens = new Set((existingOptions || []).map((o: { instrument_token: number }) => o.instrument_token));

    let addedCount = 0;
    const optionsToAdd: any[] = [];

    for (const expiry of expiries) {
      for (const strike of strikesNeeded) {
        for (const optionType of config.option_types) {
          const { data: option } = await this.supabase
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
      const { error: insertError } = await this.supabase
        .from("scanner_instruments")
        .upsert(optionsToAdd, { onConflict: "instrument_token" });

      if (insertError) {
        return { count: 0, error: `Failed to add options: ${insertError.message}` };
      }

      addedCount = optionsToAdd.length;
      console.log(`[OptionRoll] Added ${addedCount} options for ${config.underlying_symbol}`);
    }

    await this.removeExpiredOptions(config.underlying_symbol);

    await this.supabase
      .from("option_roll_config")
      .update({
        last_roll_at: new Date().toISOString(),
        last_roll_status: "success",
        last_roll_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return { count: addedCount };
  }

  private async getUnderlyingPrice(token: number): Promise<number | null> {
    const { data: tick } = await this.supabase
      .from("realtime_ticks")
      .select("last_price")
      .eq("instrument_token", token)
      .order("tick_timestamp", { ascending: false })
      .limit(1)
      .single();

    if (tick) return tick.last_price;

    const { data: candle } = await this.supabase
      .from("live_candles")
      .select("close")
      .eq("instrument_token", token)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    return candle?.close || null;
  }

  private calculateATMStrike(price: number, underlying: string): number {
    const strikeGap = underlying === "BANKNIFTY" ? 100 : underlying === "FINNIFTY" ? 50 : 50;
    return Math.round(price / strikeGap) * strikeGap;
  }

  private generateStrikesAround(atmStrike: number, range: number, underlying: string): number[] {
    const strikeGap = underlying === "BANKNIFTY" ? 100 : underlying === "FINNIFTY" ? 50 : 50;
    const strikes: number[] = [];

    for (let i = -range; i <= range; i++) {
      strikes.push(atmStrike + i * strikeGap);
    }

    return strikes;
  }

  private async getActiveExpiries(config: OptionRollConfig): Promise<string[]> {
    const today = new Date();
    const expiries: string[] = [];

    const { data: allExpiries } = await this.supabase
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
        const lastThursday = this.getLastThursday(date.getFullYear(), date.getMonth());
        return date.toDateString() === lastThursday.toDateString();
      });
      if (monthlyExpiry && !expiries.includes(monthlyExpiry)) {
        expiries.push(monthlyExpiry);
      }
    }

    return expiries;
  }

  private getLastThursday(year: number, month: number): Date {
    const date = new Date(year, month + 1, 0);
    while (date.getDay() !== 4) {
      date.setDate(date.getDate() - 1);
    }
    return date;
  }

  private async removeExpiredOptions(underlying: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    const { data: expired } = await this.supabase
      .from("scanner_instruments")
      .select("instrument_token")
      .eq("category", `OPTION_${underlying}`)
      .lt("expiry", today);

    if (expired && expired.length > 0) {
      const tokens = expired.map((e: { instrument_token: number }) => e.instrument_token);

      await this.supabase
        .from("scanner_instruments")
        .delete()
        .in("instrument_token", tokens);

      await this.supabase
        .from("instrument_subscriptions")
        .delete()
        .in("instrument_token", tokens);

      console.log(`[OptionRoll] Removed ${tokens.length} expired options for ${underlying}`);
    }
  }
}
