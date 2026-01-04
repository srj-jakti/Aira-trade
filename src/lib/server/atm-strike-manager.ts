import { supabaseAdmin } from "@/lib/supabase/admin";
import { apiKeyPoolManager } from "./api-key-pool-manager";

const KEY_INDICES = [
  { name: "NIFTY", token: 256265, strikeStep: 50, exchange: "NFO" },
  { name: "BANKNIFTY", token: 260105, strikeStep: 100, exchange: "NFO" },
  { name: "FINNIFTY", token: 257801, strikeStep: 50, exchange: "NFO" },
  { name: "SENSEX", token: 265, strikeStep: 100, exchange: "BFO" },
  { name: "BANKEX", token: 274441, strikeStep: 100, exchange: "BFO" },
];

const STRIKES_PER_SIDE = 20;
const ATM_SHIFT_THRESHOLD_PERCENT = 0.5;

interface AtmTracker {
  indexName: string;
  indexToken: number;
  currentPrice: number;
  currentAtmStrike: number;
  lastAtmStrike: number;
  strikeStep: number;
  subscribedStrikes: number[];
}

class AtmStrikeManager {
  private static instance: AtmStrikeManager;
  private trackers: Map<string, AtmTracker> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): AtmStrikeManager {
    if (!AtmStrikeManager.instance) {
      AtmStrikeManager.instance = new AtmStrikeManager();
    }
    return AtmStrikeManager.instance;
  }

  async initialize(): Promise<void> {
    console.log("[AtmStrikeManager] Initializing...");

    for (const idx of KEY_INDICES) {
      const { data: existing } = await supabaseAdmin
        .from("atm_strike_tracker")
        .select("*")
        .eq("index_name", idx.name)
        .single();

      if (existing) {
        this.trackers.set(idx.name, {
          indexName: existing.index_name,
          indexToken: existing.index_token,
          currentPrice: parseFloat(existing.current_price) || 0,
          currentAtmStrike: parseFloat(existing.current_atm_strike) || 0,
          lastAtmStrike: parseFloat(existing.last_atm_strike) || 0,
          strikeStep: parseFloat(existing.strike_step) || idx.strikeStep,
          subscribedStrikes: existing.subscribed_strikes || [],
        });
      } else {
        await supabaseAdmin.from("atm_strike_tracker").insert({
          index_name: idx.name,
          index_token: idx.token,
          strike_step: idx.strikeStep,
          subscribed_strikes: [],
        });

        this.trackers.set(idx.name, {
          indexName: idx.name,
          indexToken: idx.token,
          currentPrice: 0,
          currentAtmStrike: 0,
          lastAtmStrike: 0,
          strikeStep: idx.strikeStep,
          subscribedStrikes: [],
        });
      }
    }

    console.log(`[AtmStrikeManager] Initialized ${this.trackers.size} index trackers`);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    await this.initialize();
    this.isRunning = true;

    this.checkInterval = setInterval(() => this.checkAllIndices(), 5000);
    console.log("[AtmStrikeManager] Started ATM monitoring (5s interval)");
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log("[AtmStrikeManager] Stopped ATM monitoring");
  }

  async checkAllIndices(): Promise<void> {
    for (const [indexName, tracker] of this.trackers) {
      try {
        await this.checkAndUpdateAtm(indexName, tracker);
      } catch (error) {
        console.error(`[AtmStrikeManager] Error checking ${indexName}:`, error);
      }
    }
  }

  async checkAndUpdateAtm(indexName: string, tracker: AtmTracker): Promise<void> {
    const { data: tick } = await supabaseAdmin
      .from("realtime_ticks")
      .select("last_price")
      .eq("instrument_token", tracker.indexToken)
      .order("tick_timestamp", { ascending: false })
      .limit(1)
      .single();

    if (!tick || !tick.last_price) return;

    const currentPrice = parseFloat(tick.last_price);
    const newAtmStrike = this.calculateAtmStrike(currentPrice, tracker.strikeStep);

    tracker.currentPrice = currentPrice;

    if (tracker.currentAtmStrike === 0) {
      tracker.currentAtmStrike = newAtmStrike;
      tracker.lastAtmStrike = newAtmStrike;
      await this.subscribeNearAtmOptions(indexName, tracker, newAtmStrike);
      return;
    }

    if (newAtmStrike !== tracker.currentAtmStrike) {
      const shiftPercent = Math.abs(newAtmStrike - tracker.currentAtmStrike) / tracker.currentAtmStrike * 100;

      if (shiftPercent >= ATM_SHIFT_THRESHOLD_PERCENT) {
        console.log(`[AtmStrikeManager] ${indexName} ATM shifted: ${tracker.currentAtmStrike} -> ${newAtmStrike}`);
        
        tracker.lastAtmStrike = tracker.currentAtmStrike;
        tracker.currentAtmStrike = newAtmStrike;

        await this.subscribeNearAtmOptions(indexName, tracker, newAtmStrike);
      }
    }
  }

  calculateAtmStrike(price: number, step: number): number {
    return Math.round(price / step) * step;
  }

  async subscribeNearAtmOptions(
    indexName: string,
    tracker: AtmTracker,
    atmStrike: number
  ): Promise<void> {
    const indexConfig = KEY_INDICES.find(i => i.name === indexName);
    if (!indexConfig) return;

    const segment = indexConfig.exchange === "NFO" ? "NFO-OPT" : "BFO-OPT";
    const today = new Date().toISOString().split("T")[0];

    const strikesNeeded: number[] = [];
    for (let i = -STRIKES_PER_SIDE; i <= STRIKES_PER_SIDE; i++) {
      strikesNeeded.push(atmStrike + i * tracker.strikeStep);
    }

    const { data: options } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, strike, instrument_type, expiry")
      .eq("segment", segment)
      .eq("name", indexName)
      .in("strike", strikesNeeded)
      .gte("expiry", today)
      .order("expiry", { ascending: true });

    if (!options || options.length === 0) return;

    const expiryDates = [...new Set(options.map(o => o.expiry))].sort();
    const nearestExpiry = expiryDates[0];

    const tokensToSubscribe: number[] = [];
    const strikes: number[] = [];

    for (const opt of options) {
      if (opt.expiry === nearestExpiry) {
        tokensToSubscribe.push(opt.instrument_token);
        if (!strikes.includes(Number(opt.strike))) {
          strikes.push(Number(opt.strike));
        }
      }
    }

    if (tracker.subscribedStrikes.length > 0) {
      const oldTokens = await this.getTokensForStrikes(indexName, segment, tracker.subscribedStrikes, nearestExpiry);
      if (oldTokens.length > 0) {
        await supabaseAdmin
          .from("instruments")
          .update({ is_subscribed: false, updated_at: new Date().toISOString() })
          .in("instrument_token", oldTokens);
      }
    }

    if (tokensToSubscribe.length > 0) {
      await supabaseAdmin
        .from("instruments")
        .update({
          is_subscribed: true,
          subscription_mode: "quote",
          subscription_priority: "atm_auto",
          updated_at: new Date().toISOString(),
        })
        .in("instrument_token", tokensToSubscribe);
    }

    tracker.subscribedStrikes = strikes;

    await supabaseAdmin
      .from("atm_strike_tracker")
      .update({
        current_price: tracker.currentPrice,
        current_atm_strike: tracker.currentAtmStrike,
        last_atm_strike: tracker.lastAtmStrike,
        subscribed_strikes: strikes,
        last_shift_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("index_name", indexName);

    console.log(`[AtmStrikeManager] ${indexName}: Subscribed ${tokensToSubscribe.length} options around ATM ${atmStrike}`);
  }

  async getTokensForStrikes(
    indexName: string,
    segment: string,
    strikes: number[],
    expiry: string
  ): Promise<number[]> {
    const { data: options } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .eq("segment", segment)
      .eq("name", indexName)
      .eq("expiry", expiry)
      .in("strike", strikes);

    return (options || []).map(o => o.instrument_token);
  }

  async getTrackerStatus(): Promise<AtmTracker[]> {
    return Array.from(this.trackers.values());
  }

  async forceRefresh(indexName?: string): Promise<void> {
    if (indexName) {
      const tracker = this.trackers.get(indexName);
      if (tracker) {
        tracker.currentAtmStrike = 0;
        await this.checkAndUpdateAtm(indexName, tracker);
      }
    } else {
      for (const [name, tracker] of this.trackers) {
        tracker.currentAtmStrike = 0;
        await this.checkAndUpdateAtm(name, tracker);
      }
    }
  }
}

export const atmStrikeManager = AtmStrikeManager.getInstance();
