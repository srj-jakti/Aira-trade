import { supabaseAdmin } from "@/lib/supabase/admin";

interface ActiveTradeInstrument {
  userId: string;
  instrumentToken: number;
  tradingsymbol: string;
  tradeType: string;
  entryPrice: number;
  quantity: number;
}

class ActiveTradeSubscriptionManager {
  private static instance: ActiveTradeSubscriptionManager;
  private activeTradeTokens: Set<number> = new Set();
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ActiveTradeSubscriptionManager {
    if (!ActiveTradeSubscriptionManager.instance) {
      ActiveTradeSubscriptionManager.instance = new ActiveTradeSubscriptionManager();
    }
    return ActiveTradeSubscriptionManager.instance;
  }

  async start(): Promise<void> {
    console.log("[ActiveTradeManager] Starting trade subscription monitor...");
    
    await this.syncActiveTradeSubscriptions();
    
    this.checkInterval = setInterval(() => this.syncActiveTradeSubscriptions(), 30000);
    console.log("[ActiveTradeManager] Started (30s interval)");
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("[ActiveTradeManager] Stopped");
  }

  async registerTrade(trade: ActiveTradeInstrument): Promise<void> {
    console.log(`[ActiveTradeManager] Registering trade: ${trade.tradingsymbol}`);

    await supabaseAdmin.from("active_trade_instruments").upsert({
      user_id: trade.userId,
      instrument_token: trade.instrumentToken,
      tradingsymbol: trade.tradingsymbol,
      trade_type: trade.tradeType,
      entry_price: trade.entryPrice,
      quantity: trade.quantity,
      is_active: true,
      created_at: new Date().toISOString(),
    }, { onConflict: "user_id,instrument_token,is_active" });

    await this.ensureInstrumentSubscribed(trade.instrumentToken);
    this.activeTradeTokens.add(trade.instrumentToken);
  }

  async closeTrade(userId: string, instrumentToken: number): Promise<void> {
    console.log(`[ActiveTradeManager] Closing trade: ${instrumentToken}`);

    await supabaseAdmin
      .from("active_trade_instruments")
      .update({
        is_active: false,
        closed_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("instrument_token", instrumentToken)
      .eq("is_active", true);

    const { count } = await supabaseAdmin
      .from("active_trade_instruments")
      .select("*", { count: "exact", head: true })
      .eq("instrument_token", instrumentToken)
      .eq("is_active", true);

    if (!count || count === 0) {
      this.activeTradeTokens.delete(instrumentToken);
    }
  }

  async syncActiveTradeSubscriptions(): Promise<void> {
    try {
      const { data: activeTrades } = await supabaseAdmin
        .from("active_trade_instruments")
        .select("instrument_token")
        .eq("is_active", true);

      if (!activeTrades || activeTrades.length === 0) {
        this.activeTradeTokens.clear();
        return;
      }

      const tokens = [...new Set(activeTrades.map(t => t.instrument_token))];
      this.activeTradeTokens = new Set(tokens);

      const { data: currentSubscriptions } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, is_subscribed")
        .in("instrument_token", tokens);

      const notSubscribed = tokens.filter(token => {
        const inst = currentSubscriptions?.find(s => s.instrument_token === token);
        return !inst?.is_subscribed;
      });

      if (notSubscribed.length > 0) {
        await supabaseAdmin
          .from("instruments")
          .update({
            is_subscribed: true,
            subscription_mode: "full",
            subscription_priority: "active_trade",
            updated_at: new Date().toISOString(),
          })
          .in("instrument_token", notSubscribed);

        console.log(`[ActiveTradeManager] Force-subscribed ${notSubscribed.length} trade instruments`);
      }
    } catch (error) {
      console.error("[ActiveTradeManager] Sync error:", error);
    }
  }

  async ensureInstrumentSubscribed(instrumentToken: number): Promise<void> {
    const { data: instrument } = await supabaseAdmin
      .from("instruments")
      .select("is_subscribed, subscription_mode")
      .eq("instrument_token", instrumentToken)
      .single();

    if (!instrument?.is_subscribed || instrument.subscription_mode !== "full") {
      await supabaseAdmin
        .from("instruments")
        .update({
          is_subscribed: true,
          subscription_mode: "full",
          subscription_priority: "active_trade",
          updated_at: new Date().toISOString(),
        })
        .eq("instrument_token", instrumentToken);

      console.log(`[ActiveTradeManager] Subscribed instrument ${instrumentToken} in FULL mode`);
    }
  }

  async getActiveTradeInstruments(): Promise<number[]> {
    return Array.from(this.activeTradeTokens);
  }

  async getTradesByUser(userId: string): Promise<ActiveTradeInstrument[]> {
    const { data: trades } = await supabaseAdmin
      .from("active_trade_instruments")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    return (trades || []).map(t => ({
      userId: t.user_id,
      instrumentToken: t.instrument_token,
      tradingsymbol: t.tradingsymbol,
      tradeType: t.trade_type,
      entryPrice: parseFloat(t.entry_price),
      quantity: t.quantity,
    }));
  }

  async getActiveTradeStats(): Promise<{
    totalActiveTrades: number;
    uniqueInstruments: number;
    usersWithTrades: number;
  }> {
    const { data: stats } = await supabaseAdmin
      .from("active_trade_instruments")
      .select("user_id, instrument_token")
      .eq("is_active", true);

    if (!stats) {
      return { totalActiveTrades: 0, uniqueInstruments: 0, usersWithTrades: 0 };
    }

    const uniqueInstruments = new Set(stats.map(s => s.instrument_token)).size;
    const uniqueUsers = new Set(stats.map(s => s.user_id)).size;

    return {
      totalActiveTrades: stats.length,
      uniqueInstruments,
      usersWithTrades: uniqueUsers,
    };
  }
}

export const activeTradeManager = ActiveTradeSubscriptionManager.getInstance();
