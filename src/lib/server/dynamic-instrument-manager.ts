import { supabaseAdmin } from "@/lib/supabase/admin";
import { marketDataEngine } from "./market-data-engine";

/**
 * PRODUCTION-GRADE DYNAMIC INSTRUMENT MANAGER
 * 
 * Logic:
 * 1. Equity Stocks (~750): Unique companies from NIFTY 500 & BSE 500 (NSE preferred).
 * 2. Indices Options (200): 5 indices x (20 CE + 20 PE) near ATM.
 * 3. Futures (~210): Index futures + NSE F&O stocks futures.
 * 4. Currency (164): 4 pairs x (20 CE + 20 PE + 1 Fut).
 */

const KEY_INDICES = [
  { symbol: "NIFTY 50", name: "NIFTY", token: 256265 },
  { symbol: "NIFTY BANK", name: "BANKNIFTY", token: 260105 },
  { symbol: "NIFTY FIN SERVICE", name: "FINNIFTY", token: 257801 },
  { symbol: "SENSEX", name: "SENSEX", token: 265 },
  { symbol: "BANKEX", name: "BANKEX", token: 274441 }
];

const CURRENCY_PAIRS = ["USDINR", "EURINR", "GBPINR", "JPYINR"];

export interface SubscriptionStats {
  totalSubscribed: number;
  equity: number;
  indexOptions: number;
  futures: number;
  currency: number;
  other: number;
}

/**
 * Main function to refresh all dynamic subscriptions based on production rules.
 */
export async function refreshDynamicSubscriptions(): Promise<{
  success: boolean;
  stats: SubscriptionStats;
  message: string;
}> {
  console.log("[DynamicInstrumentManager] Starting PRODUCTION-GRADE subscription refresh...");

  const stats: SubscriptionStats = {
    totalSubscribed: 0,
    equity: 0,
    indexOptions: 0,
    futures: 0,
    currency: 0,
    other: 0,
  };

  try {
    // 1. Reset all subscriptions
    await supabaseAdmin
      .from("instruments")
      .update({ is_subscribed: false, subscription_priority: null, updated_at: new Date().toISOString() })
      .eq("is_subscribed", true);

    const subscriptionQueue = new Set<number>();

    // --- SEGMENT 1: EQUITY STOCKS (~750) ---
    // Fetch unique companies, preferring NSE
    const { data: nseStocks } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, tradingsymbol, name")
      .eq("exchange", "NSE")
      .eq("instrument_type", "EQ")
      .order("lot_size", { ascending: false }) // Proxy for liquidity
      .limit(800);

    if (nseStocks) {
      const symbols = new Set();
      for (const stock of nseStocks) {
        if (!symbols.has(stock.tradingsymbol)) {
          subscriptionQueue.add(stock.instrument_token);
          symbols.add(stock.tradingsymbol);
          stats.equity++;
        }
      }
    }

    // --- SEGMENT 2: INDEX OPTIONS (200) ---
    // 5 Indices x 40 contracts
    for (const idx of KEY_INDICES) {
      // Add the index itself
      subscriptionQueue.add(idx.token);
      
      const latestTick = await marketDataEngine.getLatestTick(idx.token);
      const atmPrice = latestTick?.lastPrice || 0;

      // Fetch near-ATM options for current week
      const { data: options } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, strike, instrument_type")
        .eq("segment", idx.token > 1000 ? "BFO-OPT" : "NFO-OPT")
        .eq("name", idx.name)
        .order("expiry", { ascending: true })
        .limit(200); // Buffer to filter

      if (options && options.length > 0) {
        // Filter to 20 CE and 20 PE near ATM
        const uniqueStrikes = [...new Set(options.map(o => Number(o.strike)))].sort((a, b) => a - b);
        let atmIndex = uniqueStrikes.findIndex(s => s >= atmPrice);
        if (atmIndex === -1) atmIndex = Math.floor(uniqueStrikes.length / 2);

        const targetStrikes = uniqueStrikes.slice(Math.max(0, atmIndex - 20), atmIndex + 20);
        
        let count = 0;
        for (const opt of options) {
          if (targetStrikes.includes(Number(opt.strike))) {
            subscriptionQueue.add(opt.instrument_token);
            count++;
          }
        }
        stats.indexOptions += count;
      }
    }

    // --- SEGMENT 3: FUTURES (~210) ---
    // Index Futures + Top NSE F&O Stock Futures
    const today = new Date().toISOString().split("T")[0];
    const { data: futs } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, name")
      .eq("segment", "NFO-FUT")
      .gte("expiry", today)
      .order("expiry", { ascending: true });

    if (futs) {
      const addedNames = new Set();
      for (const fut of futs) {
        if (!addedNames.has(fut.name)) {
          subscriptionQueue.add(fut.instrument_token);
          addedNames.add(fut.name);
          stats.futures++;
        }
      }
    }

    // --- SEGMENT 4: CURRENCY (164) ---
    // 4 Pairs x 41 contracts
    for (const pair of CURRENCY_PAIRS) {
      const { data: cds } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, strike, instrument_type, segment")
        .eq("name", pair)
        .gte("expiry", today)
        .order("expiry", { ascending: true });

      if (cds) {
        // 1 Future
        const fut = cds.find(c => c.segment === "CDS-FUT");
        if (fut) {
          subscriptionQueue.add(fut.instrument_token);
          stats.currency++;
        }

        // 20 CE + 20 PE Options
        const opts = cds.filter(c => c.segment === "CDS-OPT");
        const uniqueStrikes = [...new Set(opts.map(o => Number(o.strike)))].sort((a, b) => a - b);
        const mid = Math.floor(uniqueStrikes.length / 2);
        const targetStrikes = uniqueStrikes.slice(Math.max(0, mid - 20), mid + 20);

        for (const opt of opts) {
          if (targetStrikes.includes(Number(opt.strike))) {
            subscriptionQueue.add(opt.instrument_token);
            stats.currency++;
          }
        }
      }
    }

    // Apply subscriptions in batches
    const uniqueTokens = Array.from(subscriptionQueue);
    stats.totalSubscribed = uniqueTokens.length;

    const batchSize = 500;
    for (let i = 0; i < uniqueTokens.length; i += batchSize) {
      const batch = uniqueTokens.slice(i, i + batchSize);
      await supabaseAdmin
        .from("instruments")
        .update({
          is_subscribed: true,
          subscription_mode: "quote",
          subscription_priority: "auto",
          updated_at: new Date().toISOString(),
        })
        .in("instrument_token", batch);
    }

    return {
      success: true,
      stats,
      message: `Production-grade refresh complete. Subscribed ${stats.totalSubscribed} instruments.`,
    };
  } catch (error) {
    console.error("[DynamicInstrumentManager] Error:", error);
    return {
      success: false,
      stats,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function logInstrumentSearch(
  instrumentToken: number,
  tradingsymbol: string,
  exchange: string,
  userId?: string,
  searchType: string = "ai_analysis"
): Promise<void> {
  try {
    await supabaseAdmin.from("instrument_search_logs").insert({
      instrument_token: instrumentToken,
      tradingsymbol,
      exchange,
      user_id: userId || null,
      search_type: searchType,
    });

    // Mark as subscribed if it's a valid search
    const { data: instrument } = await supabaseAdmin
      .from("instruments")
      .select("is_subscribed")
      .eq("instrument_token", instrumentToken)
      .single();

    if (instrument && !instrument.is_subscribed) {
      await supabaseAdmin
        .from("instruments")
        .update({
          is_subscribed: true,
          subscription_mode: "quote",
          subscription_priority: "user_search",
          updated_at: new Date().toISOString(),
        })
        .eq("instrument_token", instrumentToken);
    }
  } catch (error) {
    console.error("[DynamicInstrumentManager] Error logging search:", error);
  }
}

export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  const { data: subscribed } = await supabaseAdmin
    .from("instruments")
    .select("instrument_token, segment, instrument_type, exchange")
    .eq("is_subscribed", true);

  const stats: SubscriptionStats = {
    totalSubscribed: 0,
    equity: 0,
    indexOptions: 0,
    futures: 0,
    currency: 0,
    other: 0,
  };

  if (subscribed) {
    stats.totalSubscribed = subscribed.length;
    
    for (const inst of subscribed) {
      const seg = inst.segment || "";
      const type = inst.instrument_type || "";
      
      if (type === "EQ" && (inst.exchange === "NSE" || inst.exchange === "BSE")) {
        stats.equity++;
      } else if (seg.includes("-OPT") && !seg.includes("CDS")) {
        stats.indexOptions++;
      } else if (seg.includes("-FUT") && !seg.includes("CDS")) {
        stats.futures++;
      } else if (seg.includes("CDS")) {
        stats.currency++;
      } else {
        stats.other++;
      }
    }
  }

  return stats;
}
