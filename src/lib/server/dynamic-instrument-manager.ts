import { supabaseAdmin } from "@/lib/supabase/admin";

const NIFTY_50_STOCKS = [
  "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
  "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BPCL",
  "BHARTIARTL", "BRITANNIA", "CIPLA", "COALINDIA", "DRREDDY",
  "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE",
  "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "ITC",
  "INDUSINDBK", "INFY", "JSWSTEEL", "KOTAKBANK", "LT",
  "M&M", "MARUTI", "NTPC", "NESTLEIND", "ONGC",
  "POWERGRID", "RELIANCE", "SBILIFE", "SHRIRAMFIN", "SBIN",
  "SUNPHARMA", "TCS", "TATACONSUM", "TATAMOTORS", "TATASTEEL",
  "TECHM", "TITAN", "TRENT", "ULTRACEMCO", "WIPRO"
];

const KEY_INDICES = [
  "NIFTY 50", "NIFTY BANK", "NIFTY FIN SERVICE", "NIFTY IT",
  "NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL", "NIFTY REALTY",
  "NIFTY ENERGY", "NIFTY FMCG", "NIFTY PSE", "NIFTY MIDCAP 50",
  "NIFTY NEXT 50", "NIFTY INFRA", "INDIA VIX"
];

const ACTIVE_FNO_STOCKS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL",
  "AXISBANK", "KOTAKBANK", "LT", "ITC", "WIPRO", "HCLTECH", "TECHM",
  "MARUTI", "TATAMOTORS", "M&M", "BAJFINANCE", "BAJAJFINSV", "SUNPHARMA",
  "DRREDDY", "CIPLA", "TATASTEEL", "JSWSTEEL", "HINDALCO", "TITAN",
  "POWERGRID", "NTPC", "ONGC", "COALINDIA", "ADANIENT", "ADANIPORTS",
  "DIVISLAB", "APOLLOHOSP", "GRASIM", "ULTRACEMCO", "NESTLEIND", "BRITANNIA",
  "HINDUNILVR", "ASIANPAINT", "TATACONSUM", "EICHERMOT", "INDUSINDBK",
  "VEDL", "TATAPOWER", "ZOMATO", "PAYTM", "DMART", "IRCTC", "HAL"
];

export interface SubscriptionStats {
  totalSubscribed: number;
  indices: number;
  nifty50Stocks: number;
  nfoOptions: number;
  searchedInstruments: number;
  other: number;
}

export async function refreshDynamicSubscriptions(): Promise<{
  success: boolean;
  stats: SubscriptionStats;
  message: string;
}> {
  console.log("[DynamicInstrumentManager] Starting subscription refresh...");

  const stats: SubscriptionStats = {
    totalSubscribed: 0,
    indices: 0,
    nifty50Stocks: 0,
    nfoOptions: 0,
    searchedInstruments: 0,
    other: 0,
  };

  try {
    await supabaseAdmin
      .from("instruments")
      .update({ is_subscribed: false, subscription_priority: null, updated_at: new Date().toISOString() })
      .eq("is_subscribed", true);

    const subscriptionQueue: number[] = [];

    const { data: indices } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .eq("segment", "INDICES")
      .in("exchange", ["NSE", "BSE"])
      .in("tradingsymbol", KEY_INDICES);

    if (indices) {
      for (const idx of indices) {
        subscriptionQueue.push(idx.instrument_token);
      }
      stats.indices = indices.length;
    }

    const { data: allIndices } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .eq("segment", "INDICES")
      .eq("exchange", "NSE");

    if (allIndices) {
      for (const idx of allIndices) {
        if (!subscriptionQueue.includes(idx.instrument_token)) {
          subscriptionQueue.push(idx.instrument_token);
          stats.indices++;
        }
      }
    }

    const { data: nifty50 } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .eq("exchange", "NSE")
      .eq("instrument_type", "EQ")
      .in("tradingsymbol", NIFTY_50_STOCKS);

    if (nifty50) {
      for (const stock of nifty50) {
        subscriptionQueue.push(stock.instrument_token);
      }
      stats.nifty50Stocks = nifty50.length;
    }

    const { data: fnoStocks } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .eq("exchange", "NSE")
      .eq("instrument_type", "EQ")
      .in("tradingsymbol", ACTIVE_FNO_STOCKS);

    if (fnoStocks) {
      for (const stock of fnoStocks) {
        if (!subscriptionQueue.includes(stock.instrument_token)) {
          subscriptionQueue.push(stock.instrument_token);
          stats.other++;
        }
      }
    }

    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const { data: niftyFutures } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token")
      .eq("segment", "NFO-FUT")
      .in("name", ["NIFTY", "BANKNIFTY", "FINNIFTY"])
      .gte("expiry", today.toISOString().split("T")[0])
      .lte("expiry", nextMonth.toISOString().split("T")[0]);

    if (niftyFutures) {
      for (const fut of niftyFutures) {
        subscriptionQueue.push(fut.instrument_token);
        stats.nfoOptions++;
      }
    }

    const currentWeekEnd = new Date(today);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);

    const { data: niftyOptions } = await supabaseAdmin
      .from("instruments")
      .select("instrument_token, strike, instrument_type")
      .eq("segment", "NFO-OPT")
      .in("name", ["NIFTY", "BANKNIFTY"])
      .gte("expiry", today.toISOString().split("T")[0])
      .lte("expiry", currentWeekEnd.toISOString().split("T")[0])
      .order("strike", { ascending: true });

    if (niftyOptions && niftyOptions.length > 0) {
      const strikes = [...new Set(niftyOptions.map(o => o.strike))].sort((a, b) => Number(a) - Number(b));
      const midIndex = Math.floor(strikes.length / 2);
      const atmStrikes = strikes.slice(Math.max(0, midIndex - 15), midIndex + 15);

      for (const opt of niftyOptions) {
        if (atmStrikes.includes(opt.strike)) {
          subscriptionQueue.push(opt.instrument_token);
          stats.nfoOptions++;
        }
      }
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: searchedInstruments } = await supabaseAdmin
      .from("instrument_interest_log")
      .select("instrument_token")
      .gte("created_at", sevenDaysAgo);

    if (searchedInstruments) {
      const searchedTokens = [...new Set(searchedInstruments.map(s => s.instrument_token))];
      for (const token of searchedTokens) {
        if (!subscriptionQueue.includes(token)) {
          subscriptionQueue.push(token);
          stats.searchedInstruments++;
        }
      }
    }

    const { data: aiSearchLogs } = await supabaseAdmin
      .from("instrument_search_logs")
      .select("instrument_token")
      .gte("created_at", sevenDaysAgo);

    if (aiSearchLogs) {
      const aiTokens = [...new Set(aiSearchLogs.map(s => s.instrument_token))];
      for (const token of aiTokens) {
        if (!subscriptionQueue.includes(token)) {
          subscriptionQueue.push(token);
          stats.searchedInstruments++;
        }
      }
    }

    // Add Top Liquid Stocks to reach the discussed ~1750 limit if needed
    const TARGET_LIMIT = 1750;
    if (subscriptionQueue.length < TARGET_LIMIT) {
      const remaining = TARGET_LIMIT - subscriptionQueue.length;
      const { data: topStocks } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token")
        .eq("exchange", "NSE")
        .eq("instrument_type", "EQ")
        .order("lot_size", { ascending: false }) // Using lot_size as a proxy or we can use another metric if available
        .limit(remaining);

      if (topStocks) {
        for (const stock of topStocks) {
          if (!subscriptionQueue.includes(stock.instrument_token)) {
            subscriptionQueue.push(stock.instrument_token);
            stats.other++;
          }
        }
      }
    }

    const uniqueTokens = [...new Set(subscriptionQueue)].slice(0, TARGET_LIMIT);
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

    console.log(`[DynamicInstrumentManager] Subscribed ${stats.totalSubscribed} instruments`);

    return {
      success: true,
      stats,
      message: `Subscribed ${stats.totalSubscribed} instruments: ${stats.indices} indices, ${stats.nifty50Stocks} NIFTY50 stocks, ${stats.nfoOptions} NFO, ${stats.searchedInstruments} searched`,
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

    await supabaseAdmin.from("instrument_interest_log").insert({
      instrument_token: instrumentToken,
      interest_type: searchType,
      user_id: userId || null,
      weight: searchType === "ai_analysis" ? 5 : 2,
    });

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

export async function getSubscriptionStats(): Promise<SubscriptionStats & { lastRefresh?: string }> {
  const { data: subscribed } = await supabaseAdmin
    .from("instruments")
    .select("instrument_token, segment, instrument_type, subscription_priority")
    .eq("is_subscribed", true);

  const stats: SubscriptionStats & { lastRefresh?: string } = {
    totalSubscribed: 0,
    indices: 0,
    nifty50Stocks: 0,
    nfoOptions: 0,
    searchedInstruments: 0,
    other: 0,
  };

  if (subscribed) {
    stats.totalSubscribed = subscribed.length;
    stats.indices = subscribed.filter(s => s.segment === "INDICES").length;
    stats.nifty50Stocks = subscribed.filter(s => s.segment === "NSE" && s.instrument_type === "EQ").length;
    stats.nfoOptions = subscribed.filter(s => s.segment?.includes("NFO")).length;
    stats.searchedInstruments = subscribed.filter(s => s.subscription_priority === "user_search").length;
    stats.other = stats.totalSubscribed - stats.indices - stats.nifty50Stocks - stats.nfoOptions;
  }

  return stats;
}
