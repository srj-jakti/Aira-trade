import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tradeExecutionEngine, OrderParams } from "@/lib/server/trade-execution-engine";

export async function POST() {
  try {
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
    const selectedStrategyIds = config.selectedStrategies || [];

    if (selectedStrategyIds.length === 0) {
      return NextResponse.json({ success: true, message: "No strategies selected", found: 0 });
    }

    // 2. Load Selected Strategies
    const { data: strategies } = await supabase
      .from("strategies")
      .select("*")
      .in("id", selectedStrategyIds)
      .eq("is_active", true);

    if (!strategies || strategies.length === 0) {
      return NextResponse.json({ success: true, message: "No active strategies found", found: 0 });
    }

    // 3. Get Real-time Market Data
    // For this implementation, we'll fetch the latest ticks for the symbols being monitored
    // In a real scenario, this would be a continuous stream or a broad scan of Nifty 50/Liquid stocks
    const { data: ticks } = await supabase
      .from("realtime_ticks")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(100); // Get latest snapshots

    if (!ticks || ticks.length === 0) {
      return NextResponse.json({ success: true, message: "No real-time data available", found: 0 });
    }

    let signalsFound = 0;

    // 4. Process Each Tick against Each Strategy
    for (const tick of ticks) {
      for (const strategy of strategies) {
        // Evaluate logic (simplified for this implementation)
        // In reality, this would use a proper technical analysis library or AI evaluator
        const signal = evaluateStrategy(strategy, tick);

        if (signal && signal !== 'HOLD') {
          signalsFound++;
          
          // Generate/Update Signal in Database
          const { data: existingSignal } = await supabase
            .from("ai_signals")
            .select("*")
            .eq("user_id", user.id)
            .eq("instrument_token", tick.instrument_token)
            .eq("status", "active")
            .single();

          if (!existingSignal) {
            // New Signal
            const entryPrice = tick.last_price;
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
                tradingsymbol: tick.tradingsymbol,
                instrument_token: tick.instrument_token,
                direction: signal,
                entry_price: entryPrice,
                target_price: targetPrice,
                sl_price: slPrice,
                status: 'active',
                strategy_id: strategy.id,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            // 5. Auto Trading Execution
            if (prefs.auto_trading_enabled && newSignal) {
              await executeAutoTrade(user.id, newSignal, prefs, config);
            }
          } else {
            // Update existing signal (Check for Target/SL Hit)
            await updateSignalStatus(supabase, existingSignal, tick);
          }
        }
      }
    }

    return NextResponse.json({ success: true, found: signalsFound });
  } catch (error: any) {
    console.error("Scanner process error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Simplified evaluator logic
function evaluateStrategy(strategy: any, tick: any): 'BUY' | 'SELL' | 'HOLD' {
  // Real implementation would parse strategy.buy_entry_logic etc.
  // For demonstration, we'll use a placeholder logic
  const price = tick.last_price;
  const change = tick.ohlc?.close ? (price - tick.ohlc.close) / tick.ohlc.close : 0;
  
  if (change > 0.01) return 'BUY';
  if (change < -0.01) return 'SELL';
  return 'HOLD';
}

async function updateSignalStatus(supabase: any, signal: any, tick: any) {
  const currentPrice = tick.last_price;
  let newStatus = signal.status;
  let exitPrice = null;
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

  if (newStatus !== signal.status) {
    pnl = signal.direction === 'BUY' 
      ? (exitPrice! - signal.entry_price) 
      : (signal.entry_price - exitPrice!);

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

async function executeAutoTrade(userId: string, signal: any, prefs: any, config: any) {
  // Calculate quantity based on max allocation
  const allocation = prefs.max_allocation_per_trade || 10000;
  let quantity = Math.floor(allocation / signal.entry_price);
  
  if (quantity === 0) return;

  const orderParams: OrderParams = {
    tradingsymbol: signal.tradingsymbol,
    exchange: "NSE", // Default or from tick
    transactionType: signal.direction,
    orderType: "MARKET",
    product: config.orderType || "MIS",
    quantity: quantity
  };

  // 6. Handle Order Slicing (Iceberg)
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
