import { strategyService } from "../src/lib/server/strategy-service";

async function main() {
  const strategyId = 2; // Reliance Trend Master
  const instrumentTokens = [969473]; // Reliance
  const timeframe = "15m";

  const strategy = {
    name: "Reliance Quick Momentum",
    description: "Momentum scalping strategy using EMA cross and RSI strength.",
    buy_entry_logic: { conditions: ["Price crosses above EMA(9)", "RSI > 55"], indicators: ["EMA", "RSI"] },
    buy_stop_loss: { parameters: { percentage: 0.8 } },
    buy_target: { parameters: { percentage: 2.0 } },
    buy_trailing_sl: { parameters: { active: true } },
    sell_entry_logic: { conditions: ["Price crosses below EMA(9)"], indicators: ["EMA"] },
    sell_stop_loss: { parameters: { percentage: 0.8 } },
    sell_target: { parameters: { percentage: 2.0 } },
    sell_trailing_sl: { parameters: { active: false } },
    hold_logic: { conditions: [] }
  };

  console.log("Starting backtest for Reliance Trend Master...");
  try {
    const result = await strategyService.runBacktest(strategy as any, instrumentTokens, timeframe);
    console.log("Backtest Result Summary:");
    console.log("- Total Trades:", result.total_trades);
    console.log("- Win Rate:", result.win_rate.toFixed(2), "%");
    console.log("- Net P&L:", result.net_pnl.toFixed(2));
    console.log("- Net P&L %:", result.net_pnl_percentage.toFixed(2), "%");
    console.log("- Max Drawdown:", result.max_drawdown.toFixed(2));
    
    // Save the result to DB for verification in UI
    await strategyService.saveBacktestResult(strategyId, 1, instrumentTokens, timeframe, result, strategy as any);
    console.log("Backtest result saved to database.");
  } catch (error) {
    console.error("Backtest failed:", error);
  }
}

main();
