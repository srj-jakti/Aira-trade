import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { StrategyService } from "../src/lib/server/strategy-service";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backtestAdminStrategies() {
  console.log("🚀 Starting backtest for admin strategies...\n");

  // Get all admin strategies
  const { data: strategies, error } = await supabase
    .from("strategies")
    .select("id, name, category, executable_strategy")
    .eq("user_id", "00000000-0000-0000-0000-000000000000")
    .order("id");

  if (error) {
    console.error("❌ Error fetching strategies:", error);
    return;
  }

  if (!strategies || strategies.length === 0) {
    console.log("⚠️  No admin strategies found");
    return;
  }

  console.log(`📊 Found ${strategies.length} admin strategies\n`);

  const strategyService = StrategyService.getInstance();

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

      const result = await strategyService.runBacktest({
        strategyId: strategy.id,
        instrumentToken,
        timeframe,
        capital: 100000,
      });

      if (result.success) {
        console.log(`✅ ${strategy.name}: ${result.totalTrades} trades, ${result.netPnlPercentage.toFixed(2)}% P&L, ${result.winRate.toFixed(2)}% win rate`);
      } else {
        console.log(`⚠️  ${strategy.name}: Backtest completed but no trades generated`);
      }
    } catch (error: any) {
      console.error(`❌ ${strategy.name}: ${error.message}`);
    }

    // Small delay between backtests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n✨ Backtest complete!");
}

backtestAdminStrategies().catch(console.error);
