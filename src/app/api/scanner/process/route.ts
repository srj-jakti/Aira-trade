import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tradeExecutionEngine, OrderParams } from "@/lib/server/trade-execution-engine";
import { checkKillSwitch } from "@/lib/server/kill-switches";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  try {
    // CHECK KILL SWITCHES FIRST
    const scannerCheck = await checkKillSwitch("scanner");
    if (!scannerCheck.allowed) {
      return NextResponse.json({ 
        success: false, 
        message: scannerCheck.reason,
        found: 0 
      });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Load Scanner Config & Preferences
    const { data: prefs } = await supabase
      .from("trading_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!prefs || !prefs.is_scanner_active) {
      return NextResponse.json({ success: true, message: "Scanner is inactive", found: 0 });
    }

    const config = prefs.scanner_config || {};

    // 2. Load ALL Active Strategies
    const { data: strategies } = await supabase
      .from("strategies")
      .select("*")
      .eq("is_active", true);

    if (!strategies || strategies.length === 0) {
      return NextResponse.json({ success: true, message: "No active strategies found", found: 0 });
    }

    // Check risk limits
    const { data: signalsToday } = await supabase
      .from("ai_signals")
      .select("pnl")
      .eq("user_id", user.id)
      .gte("created_at", new Date().toISOString().split('T')[0]);

    const currentPnl = (signalsToday || []).reduce((acc, s) => acc + (s.pnl || 0), 0);
    
    if (prefs.daily_profit_limit && currentPnl >= prefs.daily_profit_limit) {
      return NextResponse.json({ success: true, message: "Daily profit target reached", found: 0 });
    }
    if (prefs.daily_loss_limit && currentPnl <= -prefs.daily_loss_limit) {
      return NextResponse.json({ success: true, message: "Daily loss limit reached", found: 0 });
    }

    // 3. PREFER AGGREGATED CANDLES, FALLBACK TO RAW TICKS
    const staleThreshold = new Date(Date.now() - 30000).toISOString();
    
    // Try aggregated 5s candles first (less noise)
    const { data: aggregatedCandles } = await supabaseAdmin
      .from("aggregated_candles_5s")
      .select("instrument_token, open, high, low, close, volume, oi, bucket_start")
      .gte("bucket_start", staleThreshold)
      .order("bucket_start", { ascending: false });

    let dataSource: "aggregated" | "raw" = "aggregated";
    let marketData: Array<{
      instrument_token: number;
      last_price: number;
      open: number | null;
      high: number | null;
      low: number | null;
      close: number | null;
      volume: number | null;
      change_percent: number | null;
    }> = [];

    if (aggregatedCandles && aggregatedCandles.length > 0) {
      // Use aggregated candles (deduplicate by token, keep latest)
      const byToken = new Map<number, typeof aggregatedCandles[0]>();
      for (const candle of aggregatedCandles) {
        if (!byToken.has(candle.instrument_token)) {
          byToken.set(candle.instrument_token, candle);
        }
      }
      
      marketData = Array.from(byToken.values()).map(c => ({
        instrument_token: c.instrument_token,
        last_price: c.close,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.open, // Previous close approximation
        volume: c.volume,
        change_percent: c.open ? ((c.close - c.open) / c.open) * 100 : null,
      }));
    } else {
      // Fallback to raw ticks
      dataSource = "raw";
      const { data: latestTicks } = await supabaseAdmin
        .from("realtime_ticks")
        .select("instrument_token, last_price, open, high, low, close, change_percent, volume, tick_timestamp")
        .gte("tick_timestamp", staleThreshold)
        .order("tick_timestamp", { ascending: false });

      if (!latestTicks || latestTicks.length === 0) {
        return NextResponse.json({ 
          success: true, 
          message: "No live market data available. Ensure WebSocket worker is running.", 
          found: 0 
        });
      }

      const ticksByToken = new Map<number, typeof latestTicks[0]>();
      for (const tick of latestTicks) {
        if (!ticksByToken.has(tick.instrument_token)) {
          ticksByToken.set(tick.instrument_token, tick);
        }
      }

      marketData = Array.from(ticksByToken.values()).map(t => ({
        instrument_token: t.instrument_token,
        last_price: t.last_price,
        open: t.open,
        high: t.high,
        low: t.low,
        close: t.close,
        volume: t.volume,
        change_percent: t.change_percent,
      }));
    }

    if (marketData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No market data available", 
        found: 0 
      });
    }

    let signalsFound = 0;

    // 4. Process Each Market Data Point against Each Strategy
    for (const data of marketData) {
      for (const strategy of strategies) {
        const signal = evaluateStrategy(strategy, data);

        if (signal && signal !== 'HOLD') {
          signalsFound++;
          
          // Generate/Update Signal in Database
          const { data: existingSignal } = await supabase
            .from("ai_signals")
            .select("*")
            .eq("user_id", user.id)
            .eq("instrument_token", data.instrument_token)
            .eq("status", "active")
            .single();

          if (!existingSignal) {
            // Get instrument details
            const { data: instrument } = await supabaseAdmin
              .from("instruments")
              .select("tradingsymbol, exchange")
              .eq("instrument_token", data.instrument_token)
              .single();

            // New Signal
            const entryPrice = data.last_price;
            const targetPrice = signal === 'BUY' 
              ? entryPrice * 1.02 // 2% Target
              : entryPrice * 0.98;
            const slPrice = signal === 'BUY'
              ? entryPrice * 0.99 // 1% SL
              : entryPrice * 1.01;

            const { data: newSignal } = await supabase
              .from("ai_signals")
              .insert({
                user_id: user.id,
                tradingsymbol: instrument?.tradingsymbol || `TOKEN_${data.instrument_token}`,
                instrument_token: data.instrument_token,
                direction: signal,
                entry_price: entryPrice,
                target_price: targetPrice,
                sl_price: slPrice,
                status: 'active',
                strategy_id: strategy.id,
                data_source: dataSource,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            // 5. Auto Trading Execution (with kill switch check)
            if (prefs.auto_trading_enabled && newSignal) {
              const tradingCheck = await checkKillSwitch("trading");
              if (tradingCheck.allowed) {
                await executeAutoTrade(user.id, newSignal, prefs, config, instrument?.exchange || "NSE");
              }
            }
          } else {
            // Update existing signal (Check for Target/SL Hit)
            await updateSignalStatus(supabase, existingSignal, data);
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      found: signalsFound,
      dataSource,
      instrumentsScanned: marketData.length
    });
  } catch (error: unknown) {
    console.error("Scanner process error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

function evaluateStrategy(strategy: unknown, data: {
  last_price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  change_percent: number | null;
}): 'BUY' | 'SELL' | 'HOLD' {
  const price = data.last_price;
  const close = data.close || data.open;
  
  if (!price || !close) return 'HOLD';
  
  const change = (price - close) / close;
  
  // Basic momentum strategy
  if (change > 0.01) return 'BUY';
  if (change < -0.01) return 'SELL';
  return 'HOLD';
}

async function updateSignalStatus(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, signal: {
  id: string;
  status: string;
  direction: string;
  entry_price: number;
  target_price: number;
  sl_price: number;
}, data: { last_price: number }) {
  const currentPrice = data.last_price;
  let newStatus = signal.status;
  let exitPrice: number | null = null;
  let pnl = 0;

  if (signal.direction === 'BUY') {
    if (currentPrice >= signal.target_price) {
      newStatus = 'target_hit';
      exitPrice = currentPrice;
    } else if (currentPrice <= signal.sl_price) {
      newStatus = 'sl_hit';
      exitPrice = currentPrice;
    }
  } else {
    if (currentPrice <= signal.target_price) {
      newStatus = 'target_hit';
      exitPrice = currentPrice;
    } else if (currentPrice >= signal.sl_price) {
      newStatus = 'sl_hit';
      exitPrice = currentPrice;
    }
  }

  if (newStatus !== signal.status && exitPrice !== null) {
    pnl = signal.direction === 'BUY' 
      ? (exitPrice - signal.entry_price) 
      : (signal.entry_price - exitPrice);

    await supabase
      .from("ai_signals")
      .update({
        status: newStatus,
        exit_price: exitPrice,
        exit_at: new Date().toISOString(),
        pnl: pnl
      })
      .eq("id", signal.id);
  }
}

async function executeAutoTrade(
  userId: string, 
  signal: { tradingsymbol: string; direction: string; entry_price: number; strategy_id?: string },
  prefs: { max_allocation_per_trade?: number },
  config: { orderType?: string; slicingEnabled?: boolean; maxSlicingQuantity?: number },
  exchange: string
) {
  // Calculate quantity based on max allocation
  const allocation = prefs.max_allocation_per_trade || 10000;
  const quantity = Math.floor(allocation / signal.entry_price);
  
  if (quantity === 0) return;

  const orderParams: OrderParams = {
    tradingsymbol: signal.tradingsymbol,
    exchange: exchange,
    transactionType: signal.direction as "BUY" | "SELL",
    orderType: "MARKET",
    product: config.orderType || "MIS",
    quantity: quantity
  };

  // Handle Order Slicing (Iceberg)
  if (config.slicingEnabled && quantity > (config.maxSlicingQuantity || 100)) {
    const maxSlice = config.maxSlicingQuantity || 100;
    const slices = Math.ceil(quantity / maxSlice);
    const sliceQty = Math.floor(quantity / slices);
    
    for (let i = 0; i < slices; i++) {
      const finalSliceQty = i === slices - 1 ? quantity - (sliceQty * i) : sliceQty;
      await tradeExecutionEngine.placeOrder(userId, {
        ...orderParams,
        quantity: finalSliceQty,
        tag: `AI_SLICE_${i+1}`
      }, signal.strategy_id);
      
      // Small delay between slices
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } else {
    await tradeExecutionEngine.placeOrder(userId, {
      ...orderParams,
      tag: "AI_SCANNER"
    }, signal.strategy_id);
  }
}
