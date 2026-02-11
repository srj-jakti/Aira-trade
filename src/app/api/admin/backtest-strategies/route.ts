import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { strategyService } from "@/lib/server/strategy-service";

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🚀 Starting backtest for admin strategies...");

    // Get all admin strategies
    const { data: strategies, error } = await supabaseAdmin
      .from("strategies")
      .select("id, name, category, executable_strategy")
      .eq("user_id", "00000000-0000-0000-0000-000000000000")
      .order("id");

    if (error) {
      console.error("❌ Error fetching strategies:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!strategies || strategies.length === 0) {
      return NextResponse.json({ message: "No admin strategies found" });
    }

    console.log(`📊 Found ${strategies.length} admin strategies`);

    const results = [];

    for (const strategy of strategies) {
      console.log(`\n🔄 Backtesting: ${strategy.name} (ID: ${strategy.id})`);
      
      try {
        // Use NIFTY 50 as default instrument
        const instrumentToken = 256265;
        
        // Determine timeframe based on category
        let timeframe = "15m";
        if (strategy.category === "SCALPING") {
          timeframe = "5m";
        } else if (strategy.category === "INTRADAY") {
          timeframe = "15m";
        } else if (strategy.category === "SWING") {
          timeframe = "1h";
        } else if (strategy.category === "INVESTMENT") {
          timeframe = "1d";
        }

        const result = await strategyService.runBacktest(
          strategy as any,
          [instrumentToken],
          timeframe,
          100000
        );

        console.log(`✅ ${strategy.name}: ${result.total_trades} trades, ${result.net_pnl_percentage.toFixed(2)}% P&L, ${result.win_rate.toFixed(2)}% win rate`);
        results.push({
          id: strategy.id,
          name: strategy.name,
          success: true,
          trades: result.total_trades,
          pnl: result.net_pnl_percentage,
          winRate: result.win_rate,
        });
      } catch (error: any) {
        console.error(`❌ ${strategy.name}: ${error.message}`);
        results.push({
          id: strategy.id,
          name: strategy.name,
          success: false,
          error: error.message,
        });
      }

      // Small delay between backtests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("\n✨ Backtest complete!");

    return NextResponse.json({
      success: true,
      message: `Backtested ${strategies.length} strategies`,
      results,
    });
  } catch (error: any) {
    console.error("Error in backtest endpoint:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
