# AI Trading App

An AI-driven trading platform with support for Zerodha integration and Paper Trading.

## Features

- **AI Trading Engine**: 24/7 background service for automated trade evaluation and execution.
- **Paper Trading**: Risk-free virtual trading environment with ₹10,00,000 starting balance.
- **Zerodha Integration**: Live execution on NSE using official Kite Connect API.
- **Real-time Monitoring**: Live P&L tracking and automated SL/TP management.

## Paper Trading Instructions

1. **Enable Paper Mode**: Toggle the "Paper Mode" switch in the Dashboard.
2. **Visual Cues**: When Paper Mode is active, you will see a yellow "PAPER MODE" badge. All trades will be executed virtually using real-time market data but without real capital.
3. **Starting Balance**: Every user starts with a virtual balance of ₹10,00,000.
4. **Execution**: The engine handles paper trades identically to live trades, including Stop Loss and Target Price monitoring.
5. **Switching to Live**: To trade with real capital, connect your Zerodha account and toggle off "Paper Mode". The system will switch to the "LIVE MODE" (Green badge).

## Development

### Prerequisites

- Node.js / Bun
- Supabase Project
- Zerodha API Credentials (for Live mode)

### Setup

1. Clone the repository.
2. Install dependencies: `bun install`
3. Configure `.env.local` with your Supabase and Encryption keys.
4. Run the dev server: `bun dev`

### Trading Engine

The trading engine is located in `railway/trading-engine`. It runs as a separate process in production but can be monitored via the Dashboard's "System Health" indicators.
