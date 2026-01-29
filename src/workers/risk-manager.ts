import { createClient } from "@supabase/supabase-js";
import { KiteConnect } from "kiteconnect";
import { decrypt } from "../lib/server/encryption";



export class RiskManagerWorker {
  private static instance: RiskManagerWorker;
  private isRunning = false;
  private checkInterval = 60000; // 1 minute
  private supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  private constructor() {}

  static getInstance(): RiskManagerWorker {
    if (!RiskManagerWorker.instance) {
      RiskManagerWorker.instance = new RiskManagerWorker();
    }
    return RiskManagerWorker.instance;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[RiskManager] Sentry Worker Started");
    this.monitorLoop();
  }

  async stop() {
    this.isRunning = false;
    console.log("[RiskManager] Sentry Worker Stopped");
  }

  private async monitorLoop() {
    while (this.isRunning) {
      try {
        await this.checkUserRiskProfiles();
      } catch (error) {
        console.error("[RiskManager] Monitor Loop Error:", error);
      }
      await new Promise(r => setTimeout(r, this.checkInterval));
    }
  }

  private async checkUserRiskProfiles() {
    // Fetch all active risk profiles
    const { data: profiles, error } = await this.supabase
      .from("user_risk_profiles")
      .select("*")
      .eq("is_active", true)
      .eq("kill_switch_active", false); // Only monitor if kill switch not already tripped

    if (error || !profiles) return;

    for (const profile of profiles) {
      try {
        // 1. Calculate Real-time PnL
        const { pnl, kite } = await this.calculateRealtimePnL(profile.user_id);

        if (kite === null) {
            console.log(`[RiskManager] Skipping user ${profile.user_id} (No broker connection)`);
            continue;
        }

        console.log(`[RiskManager] User ${profile.user_id} PnL: ${pnl}`);

        // 2. Update DB with current PnL
        await this.supabase
          .from("user_risk_profiles")
          .update({ current_day_pnl: pnl, updated_at: new Date().toISOString() })
          .eq("user_id", profile.user_id);

        // 3. Check Loss Limit
        if (profile.daily_loss_limit > 0 && pnl <= -profile.daily_loss_limit) {
            if (profile.kill_switch_enabled) {
                await this.triggerKillSwitch(profile.user_id, kite, "Daily Loss Limit Breached");
            }
        }

        // 4. Check Profit Target
        if (profile.daily_profit_target > 0 && pnl >= profile.daily_profit_target) {
          // Just notify for now, or implement trailing stop
          console.log(`[RiskManager] Profit Target Hit for ${profile.user_id}`);
        }
      } catch (err) {
          console.error(`[RiskManager] Error processing user ${profile.user_id}:`, err);
      }
    }
  }

  private async calculateRealtimePnL(userId: string): Promise<{ pnl: number, kite: any }> {
    // Get Broker Account
    const { data: account } = await this.supabase
        .from("user_broker_accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("is_connected", true)
        .single();

    if (!account) return { pnl: 0, kite: null };

    // Get API Key (from user_config) - Wait, previous file check showed api_key is in user_broker_accounts too? 
    // Let's re-read broker callback. It uses api_key from user_broker_accounts.
    const apiKey = account.api_key; 
    
    // Decrypt Access Token
    let accessToken = "";
    try {
        accessToken = decrypt(account.access_token);
    } catch (e) {
        console.error(`[RiskManager] Failed to decrypt token for ${userId}`);
        return { pnl: 0, kite: null };
    }

    const kite = new KiteConnect({
        api_key: apiKey,
        access_token: accessToken
    });

    try {
        // Fetch Positions
        const positions = await kite.getPositions();
        // Calculate Total PnL (Net + Day?) - Usually we care about MTM (Mark to Market) of open positions + Realized PnL
        // Zerodha positions response has 'net' (overall) and 'day' (intraday). 
        // For risk management, we usually look at 'day' PnL for daily limits.
        
        const dayPnL = positions.net.reduce((sum: number, p: any) => sum + (p.m2m || 0), 0); 
        // Note: net positions m2m includes realized + unrealized for the day usually? 
        // Or we should sum 'realised' + 'unrealised'.
        // Zerodha 'net' has 'm2m' field which is total PnL.
        
        return { pnl: dayPnL, kite };
    } catch (e) {
        console.error(`[RiskManager] Zerodha API Error for ${userId}:`, e);
        return { pnl: 0, kite: null };
    }
  }

  private async triggerKillSwitch(userId: string, kite: any, reason: string) {
    console.log(`[RiskManager] KILL SWITCH TRIGGERED for ${userId}: ${reason}`);
    
    // 1. Activate Kill Switch in DB to prevent further trading
    await this.supabase
      .from("user_risk_profiles")
      .update({ kill_switch_active: true })
      .eq("user_id", userId);

    // 2. Square off all positions
    try {
        const positions = await kite.getPositions();
        const openPositions = positions.net.filter((p: any) => p.quantity !== 0);

        for (const p of openPositions) {
            const type = p.quantity > 0 ? "SELL" : "BUY";
            const qty = Math.abs(p.quantity);
            
            try {
                await kite.placeOrder("regular", {
                    exchange: p.exchange,
                    tradingsymbol: p.tradingsymbol,
                    transaction_type: type,
                    quantity: qty,
                    product: p.product,
                    order_type: "MARKET",
                    validity: "DAY"
                });
                console.log(`[RiskManager] Square off sent for ${p.tradingsymbol}`);
            } catch (ordErr) {
                console.error(`[RiskManager] Failed to square off ${p.tradingsymbol}:`, ordErr);
            }
        }
    } catch (e) {
        console.error(`[RiskManager] Failed to fetch positions for kill switch:`, e);
    }
  }

  private async lockProfits(userId: string, pnl: number) {
    console.log(`[RiskManager] Profit Target Hit for ${userId}: ${pnl}`);
    // Implement trailing stop logic or partial booking here
  }
}

// Start worker if run directly
if (require.main === module) {
  RiskManagerWorker.getInstance().start();
}
