/**
 * DYNAMIC INSTRUMENT SUBSCRIPTION OPTIMIZER
 * Handles:
 * 1. User-driven subscriptions (searches, charts, scanners)
 * 2. AI-driven daily optimization
 * 3. Option expiry management (weekly/monthly)
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

interface InstrumentPriority {
  instrument_token: number;
  tradingsymbol: string;
  priority_score: number;
  sources: string[];
  expiry?: string;
}

class InstrumentSubscriptionOptimizer {
  private static instance: InstrumentSubscriptionOptimizer;
  private isRunning = false;
  private dailyJobInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): InstrumentSubscriptionOptimizer {
    if (!InstrumentSubscriptionOptimizer.instance) {
      InstrumentSubscriptionOptimizer.instance = new InstrumentSubscriptionOptimizer();
    }
    return InstrumentSubscriptionOptimizer.instance;
  }

  // USER-DRIVEN: Track user interest
  async trackUserInterest(
    instrumentToken: number,
    interestType: "search" | "chart" | "scanner" | "watchlist" | "position",
    userId?: string
  ): Promise<void> {
    const weight = this.getInterestWeight(interestType);
    
    await supabaseAdmin.from("instrument_interest_log").insert({
      instrument_token: instrumentToken,
      interest_type: interestType,
      user_id: userId || null,
      weight,
      created_at: new Date().toISOString(),
    });

    // Immediately mark as subscribed if high priority
    if (weight >= 5) {
      await this.ensureSubscribed(instrumentToken);
    }
  }

  private getInterestWeight(type: string): number {
    const weights: Record<string, number> = {
      position: 10,    // User has position
      scanner: 8,      // Active scanner
      watchlist: 6,    // In watchlist
      chart: 5,        // Opened chart
      search: 2,       // Searched
    };
    return weights[type] || 1;
  }

  async ensureSubscribed(instrumentToken: number): Promise<void> {
    await supabaseAdmin
      .from("instruments")
      .update({ 
        is_subscribed: true,
        subscription_priority: "high",
        subscription_mode: "quote",
        updated_at: new Date().toISOString(),
      })
      .eq("instrument_token", instrumentToken);
  }

  // AI-DRIVEN: Daily optimization job
  async runDailyOptimization(): Promise<{
    added: number;
    removed: number;
    expiryHandled: number;
  }> {
    console.log("[Optimizer] Running daily optimization...");

    const results = {
      added: 0,
      removed: 0,
      expiryHandled: 0,
    };

    // 1. Handle expired options
    results.expiryHandled = await this.handleExpiredOptions();

    // 2. Calculate priority scores
    const priorityList = await this.calculatePriorityScores();

    // 3. Determine target subscription list
    const targetList = await this.determineTargetSubscriptions(priorityList);

    // 4. Apply changes
    const { added, removed } = await this.applySubscriptionChanges(targetList);
    results.added = added;
    results.removed = removed;

    // Log results
    await supabaseAdmin.from("system_health_logs").insert({
      metric_type: "subscription_optimization",
      metric_value: results,
      severity: "info",
      message: `Daily optimization: +${added}, -${removed}, expiry handled: ${results.expiryHandled}`,
    });

    return results;
  }

  // OPTION EXPIRY: Handle weekly and monthly expiry rotation
  async handleExpiredOptions(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Unsubscribe expired options
    const { data: expired } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, tradingsymbol, expiry")
      .eq("is_subscribed", true)
      .not("expiry", "is", null)
      .lt("expiry", today.toISOString());

    if (expired && expired.length > 0) {
      const expiredTokens = expired.map(e => e.instrument_token);
      
      await supabaseAdmin
        .from("instruments")
        .update({ 
          is_subscribed: false,
          subscription_priority: null,
          updated_at: new Date().toISOString(),
        })
        .in("instrument_token", expiredTokens);

      console.log(`[Optimizer] Unsubscribed ${expiredTokens.length} expired options`);
    }

    // 2. Subscribe next expiry options
    await this.subscribeNextExpiryOptions();

    return expired?.length || 0;
  }

  private async subscribeNextExpiryOptions(): Promise<void> {
    // Get unique underlying + expiry combinations that are currently subscribed
    const { data: activeOptions } = await supabaseAdmin
      .from("instruments")
      .select("name, instrument_type, expiry")
      .eq("is_subscribed", true)
      .in("instrument_type", ["CE", "PE"])
      .not("expiry", "is", null);

    if (!activeOptions) return;

    // Get unique underlying names
    const underlyings = [...new Set(activeOptions.map(o => o.name))];

    for (const underlying of underlyings) {
      // Get next 2 weekly expiries for this underlying
      const { data: nextExpiries } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, tradingsymbol, expiry")
        .eq("name", underlying)
        .in("instrument_type", ["CE", "PE"])
        .gte("expiry", new Date().toISOString())
        .order("expiry", { ascending: true })
        .limit(100); // Get enough to cover ATM strikes

      if (!nextExpiries || nextExpiries.length === 0) continue;

      // Group by expiry
      const byExpiry = new Map<string, typeof nextExpiries>();
      for (const opt of nextExpiries) {
        const exp = opt.expiry;
        if (!byExpiry.has(exp)) byExpiry.set(exp, []);
        byExpiry.get(exp)!.push(opt);
      }

      // Subscribe to first 2 expiries
      const expiries = Array.from(byExpiry.keys()).slice(0, 2);
      for (const expiry of expiries) {
        const options = byExpiry.get(expiry)!;
        const tokensToSubscribe = options.slice(0, 20).map(o => o.instrument_token); // ATM range

        if (tokensToSubscribe.length > 0) {
          await supabaseAdmin
            .from("instruments")
            .update({
              is_subscribed: true,
              subscription_priority: "medium",
              subscription_mode: "quote",
              updated_at: new Date().toISOString(),
            })
            .in("instrument_token", tokensToSubscribe);
        }
      }
    }
  }

  private async calculatePriorityScores(): Promise<InstrumentPriority[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get interest logs from last 7 days
    const { data: interestLogs } = await supabaseAdmin
      .from("instrument_interest_log")
      .select("instrument_token, interest_type, weight")
      .gte("created_at", sevenDaysAgo);

    // Get active strategies
    const { data: strategies } = await supabaseAdmin
      .from("strategies")
      .select("id, target_instruments")
      .eq("is_active", true);

    // Get open positions
    const { data: positions } = await supabaseAdmin
      .from("positions")
      .select("instrument_token")
      .gt("quantity", 0);

    // Calculate scores
    const scores = new Map<number, InstrumentPriority>();

    // Process interest logs
    for (const log of interestLogs || []) {
      const existing: InstrumentPriority = scores.get(log.instrument_token) || {
        instrument_token: log.instrument_token,
        tradingsymbol: "",
        priority_score: 0,
        sources: [],
      };
      existing.priority_score += log.weight;
      if (!existing.sources.includes(log.interest_type)) {
        existing.sources.push(log.interest_type);
      }
      scores.set(log.instrument_token, existing);
    }

    // Add positions (highest priority)
    for (const pos of positions || []) {
      const existing: InstrumentPriority = scores.get(pos.instrument_token) || {
        instrument_token: pos.instrument_token,
        tradingsymbol: "",
        priority_score: 0,
        sources: [],
      };
      existing.priority_score += 100; // Positions are critical
      if (!existing.sources.includes("position")) {
        existing.sources.push("position");
      }
      scores.set(pos.instrument_token, existing);
    }

    // Add strategy targets
    for (const strategy of strategies || []) {
      const targets = strategy.target_instruments || [];
      for (const token of targets) {
        const existing: InstrumentPriority = scores.get(token) || {
          instrument_token: token,
          tradingsymbol: "",
          priority_score: 0,
          sources: [],
        };
        existing.priority_score += 50;
        if (!existing.sources.includes("strategy")) {
          existing.sources.push("strategy");
        }
        scores.set(token, existing);
      }
    }

    return Array.from(scores.values()).sort((a, b) => b.priority_score - a.priority_score);
  }

  private async determineTargetSubscriptions(
    priorityList: InstrumentPriority[]
  ): Promise<Set<number>> {
    const MAX_SUBSCRIPTIONS = 5000; // Conservative limit
    const target = new Set<number>();

    // Always include high-priority items
    for (const item of priorityList) {
      if (target.size >= MAX_SUBSCRIPTIONS) break;
      if (item.priority_score >= 10) {
        target.add(item.instrument_token);
      }
    }

    // Add index instruments (NIFTY, BANKNIFTY)
    const { data: indices } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .in("tradingsymbol", ["NIFTY 50", "NIFTY BANK", "NIFTY FIN SERVICE"]);

    for (const idx of indices || []) {
      target.add(idx.instrument_token);
    }

    // Add top stocks by volume (if space available)
    if (target.size < MAX_SUBSCRIPTIONS) {
      const { data: topStocks } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token")
        .eq("exchange", "NSE")
        .eq("instrument_type", "EQ")
        .order("lot_size", { ascending: false }) // Proxy for liquidity
        .limit(500);

      for (const stock of topStocks || []) {
        if (target.size >= MAX_SUBSCRIPTIONS) break;
        target.add(stock.instrument_token);
      }
    }

    return target;
  }

  private async applySubscriptionChanges(
    targetTokens: Set<number>
  ): Promise<{ added: number; removed: number }> {
    // Get currently subscribed
    const { data: currentlySubscribed } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .eq("is_subscribed", true);

    const currentSet = new Set(
      (currentlySubscribed || []).map(i => i.instrument_token)
    );

    // Calculate diff
    const toAdd = Array.from(targetTokens).filter(t => !currentSet.has(t));
    const toRemove = Array.from(currentSet).filter(t => !targetTokens.has(t));

    // Apply additions
    if (toAdd.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < toAdd.length; i += batchSize) {
        const batch = toAdd.slice(i, i + batchSize);
        await supabaseAdmin
          .from("instruments")
          .update({
            is_subscribed: true,
            subscription_priority: "low",
            subscription_mode: "ltp",
            updated_at: new Date().toISOString(),
          })
          .in("instrument_token", batch);
      }
    }

    // Apply removals (but never remove high-priority items)
    if (toRemove.length > 0) {
      await supabaseAdmin
        .from("instruments")
        .update({
          is_subscribed: false,
          subscription_priority: null,
          updated_at: new Date().toISOString(),
        })
        .in("instrument_token", toRemove)
        .neq("subscription_priority", "high");
    }

    return { added: toAdd.length, removed: toRemove.length };
  }

  // Start daily job
  startDailyJob(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Run immediately, then daily
    this.runDailyOptimization().catch(console.error);

    // Schedule for 3:00 AM daily
    const now = new Date();
    const next3AM = new Date(now);
    next3AM.setHours(3, 0, 0, 0);
    if (next3AM <= now) {
      next3AM.setDate(next3AM.getDate() + 1);
    }

    const msUntilNext = next3AM.getTime() - now.getTime();
    
    setTimeout(() => {
      this.runDailyOptimization().catch(console.error);
      
      // Then run every 24 hours
      this.dailyJobInterval = setInterval(() => {
        this.runDailyOptimization().catch(console.error);
      }, 24 * 60 * 60 * 1000);
    }, msUntilNext);

    console.log(`[Optimizer] Daily job scheduled. Next run in ${Math.round(msUntilNext / 60000)} minutes`);
  }

  stopDailyJob(): void {
    if (this.dailyJobInterval) {
      clearInterval(this.dailyJobInterval);
      this.dailyJobInterval = null;
    }
    this.isRunning = false;
  }
}

export const instrumentOptimizer = InstrumentSubscriptionOptimizer.getInstance();

// Convenience functions for API routes
export async function trackInstrumentSearch(
  instrumentToken: number,
  userId?: string
): Promise<void> {
  await instrumentOptimizer.trackUserInterest(instrumentToken, "search", userId);
}

export async function trackChartOpen(
  instrumentToken: number,
  userId?: string
): Promise<void> {
  await instrumentOptimizer.trackUserInterest(instrumentToken, "chart", userId);
}

export async function trackScannerAdd(
  instrumentToken: number,
  userId?: string
): Promise<void> {
  await instrumentOptimizer.trackUserInterest(instrumentToken, "scanner", userId);
}

export async function trackPositionOpen(
  instrumentToken: number,
  userId?: string
): Promise<void> {
  await instrumentOptimizer.trackUserInterest(instrumentToken, "position", userId);
}
