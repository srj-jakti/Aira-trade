import { supabaseAdmin } from "@/lib/supabase/admin";
import { apiKeyPoolManager } from "./api-key-pool-manager";
import { decrypt } from "./encryption";
import { atmStrikeManager } from "./atm-strike-manager";

const CURRENCY_PAIRS = ["USDINR", "EURINR", "GBPINR", "JPYINR"];

interface SyncStats {
  totalFetched: number;
  newInstruments: number;
  updatedInstruments: number;
  expiredRemoved: number;
  optionChainsRefreshed: number;
}

class DailyInstrumentSyncManager {
  private static instance: DailyInstrumentSyncManager;
  private lastSyncAt: Date | null = null;
  private isSyncing = false;

  private constructor() {}

  static getInstance(): DailyInstrumentSyncManager {
    if (!DailyInstrumentSyncManager.instance) {
      DailyInstrumentSyncManager.instance = new DailyInstrumentSyncManager();
    }
    return DailyInstrumentSyncManager.instance;
  }

  async performDailySync(): Promise<{
    success: boolean;
    stats: SyncStats;
    message: string;
  }> {
    if (this.isSyncing) {
      return { success: false, stats: this.emptyStats(), message: "Sync already in progress" };
    }

    this.isSyncing = true;
    console.log("[DailySync] Starting daily instrument sync...");

    const stats: SyncStats = {
      totalFetched: 0,
      newInstruments: 0,
      updatedInstruments: 0,
      expiredRemoved: 0,
      optionChainsRefreshed: 0,
    };

    try {
      const key = await apiKeyPoolManager.getLeastLoadedKey();
      if (!key || !key.access_token) {
        throw new Error("No API key available for sync");
      }

      const apiKey = decrypt(key.api_key);
      const accessToken = decrypt(key.access_token);

      console.log("[DailySync] Fetching instruments from Zerodha...");
      const response = await fetch("https://api.kite.trade/instruments", {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch instruments from Zerodha");
      }

      const csvText = await response.text();
      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",");

      const instruments = lines.slice(1).map(line => {
        const values = line.split(",");
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = values[i];
        });
        return obj;
      });

      stats.totalFetched = instruments.length;
      console.log(`[DailySync] Fetched ${stats.totalFetched} instruments`);

      const today = new Date().toISOString().split("T")[0];
      const expiredCount = await this.removeExpiredInstruments(today);
      stats.expiredRemoved = expiredCount;
      console.log(`[DailySync] Removed ${expiredCount} expired instruments`);

      const rows = instruments.map(i => ({
        instrument_token: parseInt(i.instrument_token),
        exchange_token: parseInt(i.exchange_token),
        tradingsymbol: i.tradingsymbol,
        name: i.name || null,
        exchange: i.exchange,
        segment: i.segment || null,
        instrument_type: i.instrument_type || null,
        tick_size: parseFloat(i.tick_size) || null,
        lot_size: parseInt(i.lot_size) || 1,
        expiry: i.expiry || null,
        strike: parseFloat(i.strike) || null,
      }));

      const batchSize = 5000;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabaseAdmin
          .from("instruments")
          .upsert(batch, { onConflict: "instrument_token" });

        if (!error) {
          stats.updatedInstruments += batch.length;
        }
      }

      console.log("[DailySync] Refreshing option chain subscriptions...");
      await atmStrikeManager.forceRefresh();
      stats.optionChainsRefreshed = 5;

      await this.refreshDynamicSubscriptions();

      this.lastSyncAt = new Date();

      await supabaseAdmin.from("system_events").insert({
        event_type: "daily_instrument_sync",
        event_data: stats,
        created_at: new Date().toISOString(),
      });

      console.log("[DailySync] Daily sync completed successfully");
      return {
        success: true,
        stats,
        message: `Synced ${stats.totalFetched} instruments, removed ${stats.expiredRemoved} expired`,
      };
    } catch (error) {
      console.error("[DailySync] Error:", error);
      return {
        success: false,
        stats,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      this.isSyncing = false;
    }
  }

  async removeExpiredInstruments(today: string): Promise<number> {
    const { data: expired } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .lt("expiry", today)
      .not("expiry", "is", null);

    if (!expired || expired.length === 0) return 0;

    const tokens = expired.map(e => e.instrument_token);

    await supabaseAdmin
      .from("instruments")
      .update({
        is_subscribed: false,
        subscription_priority: "expired",
        updated_at: new Date().toISOString(),
      })
      .in("instrument_token", tokens);

    return tokens.length;
  }

  async refreshDynamicSubscriptions(): Promise<void> {
    console.log("[DailySync] Refreshing dynamic subscriptions...");

    const today = new Date().toISOString().split("T")[0];

    await supabaseAdmin
      .from("instruments")
      .update({ is_subscribed: false, updated_at: new Date().toISOString() })
      .eq("subscription_priority", "auto");

    const { data: nseStocks } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .eq("exchange", "NSE")
      .eq("instrument_type", "EQ")
      .limit(800);

    if (nseStocks) {
      const tokens = nseStocks.map(s => s.instrument_token);
      await supabaseAdmin
        .from("instruments")
        .update({
          is_subscribed: true,
          subscription_mode: "quote",
          subscription_priority: "auto",
          updated_at: new Date().toISOString(),
        })
        .in("instrument_token", tokens);
    }

    const { data: futs } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, name")
      .eq("segment", "NFO-FUT")
      .gte("expiry", today)
      .order("expiry", { ascending: true });

    if (futs) {
      const addedNames = new Set<string>();
      const futTokens: number[] = [];
      for (const fut of futs) {
        if (!addedNames.has(fut.name)) {
          futTokens.push(fut.instrument_token);
          addedNames.add(fut.name);
        }
      }

      if (futTokens.length > 0) {
        await supabaseAdmin
          .from("instruments")
          .update({
            is_subscribed: true,
            subscription_mode: "quote",
            subscription_priority: "auto",
            updated_at: new Date().toISOString(),
          })
          .in("instrument_token", futTokens);
      }
    }

    for (const pair of CURRENCY_PAIRS) {
      const { data: cds } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, segment")
        .eq("name", pair)
        .gte("expiry", today)
        .order("expiry", { ascending: true })
        .limit(50);

      if (cds) {
        const cdTokens = cds.map(c => c.instrument_token);
        if (cdTokens.length > 0) {
          await supabaseAdmin
            .from("instruments")
            .update({
              is_subscribed: true,
              subscription_mode: "quote",
              subscription_priority: "auto",
              updated_at: new Date().toISOString(),
            })
            .in("instrument_token", cdTokens);
        }
      }
    }

    console.log("[DailySync] Dynamic subscriptions refreshed");
  }

  async cleanupOldTicks(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count } = await supabaseAdmin
      .from("realtime_ticks")
      .delete()
      .lt("tick_timestamp", cutoff)
      .select("*", { count: "exact", head: true });

    return count || 0;
  }

  async getSyncStatus(): Promise<{
    lastSyncAt: Date | null;
    isSyncing: boolean;
    subscribedCount: number;
    expiredCount: number;
  }> {
    const { count: subscribedCount } = await supabaseAdmin
      .from("instruments")
      .select("*", { count: "exact", head: true })
      .eq("is_subscribed", true);

    const today = new Date().toISOString().split("T")[0];
    const { count: expiredCount } = await supabaseAdmin
      .from("instruments")
      .select("*", { count: "exact", head: true })
      .lt("expiry", today)
      .not("expiry", "is", null);

    return {
      lastSyncAt: this.lastSyncAt,
      isSyncing: this.isSyncing,
      subscribedCount: subscribedCount || 0,
      expiredCount: expiredCount || 0,
    };
  }

  private emptyStats(): SyncStats {
    return {
      totalFetched: 0,
      newInstruments: 0,
      updatedInstruments: 0,
      expiredRemoved: 0,
      optionChainsRefreshed: 0,
    };
  }
}

export const dailySyncManager = DailyInstrumentSyncManager.getInstance();
