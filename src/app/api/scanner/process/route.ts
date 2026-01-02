import { NextResponse } from "next/server";

/**
 * DEPRECATED: Scanner Process Route
 * 
 * This endpoint is deprecated. Trading now runs automatically via the 
 * background Trading Engine deployed on Railway.
 * 
 * The background engine:
 * - Runs 24/7 independently of browser/UI
 * - Evaluates strategies automatically based on strategy_type interval
 * - Executes trades when signals are generated
 * - Manages execution locks to prevent duplicates
 * 
 * To enable auto-trading:
 * 1. Connect your broker account
 * 2. Select an active strategy
 * 3. Enable auto_trading_enabled in trading preferences
 * 
 * The engine will automatically start evaluating and trading.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated",
      message: "Trading now runs automatically via the background Trading Engine. Enable auto-trading in your settings to start.",
      deprecated: true,
      alternative: "Enable auto_trading_enabled in /api/trading/toggle",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated",
      message: "Trading now runs automatically via the background Trading Engine.",
      deprecated: true,
    },
    { status: 410 }
  );
}
