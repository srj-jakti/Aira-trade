/**
 * Script to create 20 admin-approved strategies
 * 5 Scalping, 5 Intraday, 5 Swing, 5 Investment
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { supabaseAdmin } from '../src/lib/supabase/admin';

const ADMIN_USER_ID = '6a01d9d0-d331-410b-a514-27b2c01cb211'; // sharansrj@gmail.com
const NIFTY_50_TOKEN = 256265; // NIFTY 50 index
const BANKNIFTY_TOKEN = 260105; // BANK NIFTY index

interface Strategy {
  name: string;
  description: string;
  category: 'SCALPING' | 'INTRADAY' | 'SWING' | 'INVESTMENT';
  timeframes: string[];
  instruments: number[];
  executable_strategy: any;
}

const strategies: Strategy[] = [
  // ===== SCALPING STRATEGIES (5) =====
  {
    name: "Momentum Scalper Pro",
    description: "Quick entries on strong momentum with tight stops. Targets 0.3-0.5% moves in 1-5 minutes. Uses RSI and VWAP for confirmation.",
    category: "SCALPING",
    timeframes: ["1m", "3m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Momentum Scalper Pro",
      description: "Quick momentum scalping strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 55 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "VWAP" },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 70 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 45 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "VWAP" },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 30 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.3 },
        target: { type: "PERCENTAGE", value: 0.5 },
        trailingSL: { enabled: true, activationPercent: 0.3, trailPercent: 0.15 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.3 },
        target: { type: "PERCENTAGE", value: 0.5 },
        trailingSL: { enabled: true, activationPercent: 0.3, trailPercent: 0.15 }
      },
      requiredIndicators: [
        { name: "RSI", period: 14 },
        { name: "VWAP" }
      ],
      minWarmupCandles: 20
    }
  },
  {
    name: "VWAP Bounce Scalper",
    description: "Scalps bounces from VWAP levels with volume confirmation. Targets quick 0.4-0.6% moves.",
    category: "SCALPING",
    timeframes: ["1m", "3m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "VWAP Bounce Scalper",
      description: "VWAP bounce scalping strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "CROSS_ABOVE", indicator: "VWAP" },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 50 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "CROSS_BELOW", indicator: "VWAP" },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 50 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.4 },
        target: { type: "PERCENTAGE", value: 0.6 },
        trailingSL: { enabled: true, activationPercent: 0.4, trailPercent: 0.2 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.4 },
        target: { type: "PERCENTAGE", value: 0.6 },
        trailingSL: { enabled: true, activationPercent: 0.4, trailPercent: 0.2 }
      },
      requiredIndicators: [
        { name: "VWAP" },
        { name: "RSI", period: 14 }
      ],
      minWarmupCandles: 20
    }
  },
  {
    name: "Range Breakout Scalper",
    description: "Trades breakouts from consolidation zones with volume surge. Quick 0.5-0.8% targets.",
    category: "SCALPING",
    timeframes: ["3m", "5m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Range Breakout Scalper",
      description: "Range breakout scalping strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "BB_UPPER" },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 60 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "BB_LOWER" },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 40 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.5 },
        target: { type: "PERCENTAGE", value: 0.8 },
        trailingSL: { enabled: true, activationPercent: 0.5, trailPercent: 0.25 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.5 },
        target: { type: "PERCENTAGE", value: 0.8 },
        trailingSL: { enabled: true, activationPercent: 0.5, trailPercent: 0.25 }
      },
      requiredIndicators: [
        { name: "BB_UPPER", period: 20 },
        { name: "BB_LOWER", period: 20 },
        { name: "RSI", period: 14 }
      ],
      minWarmupCandles: 20
    }
  },
  {
    name: "Order Flow Scalper",
    description: "Uses volume and price action for quick trades. Targets 0.4-0.7% moves with tight risk.",
    category: "SCALPING",
    timeframes: ["1m", "3m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Order Flow Scalper",
      description: "Order flow scalping strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_action", action: "BULLISH_CANDLE" },
          { type: "indicator", name: "RSI", period: 9, operator: ">", value: 55 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 9 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_action", action: "BEARISH_CANDLE" },
          { type: "indicator", name: "RSI", period: 9, operator: "<", value: 45 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 9 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.35 },
        target: { type: "PERCENTAGE", value: 0.7 },
        trailingSL: { enabled: true, activationPercent: 0.4, trailPercent: 0.2 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.35 },
        target: { type: "PERCENTAGE", value: 0.7 },
        trailingSL: { enabled: true, activationPercent: 0.4, trailPercent: 0.2 }
      },
      requiredIndicators: [
        { name: "RSI", period: 9 },
        { name: "EMA", period: 9 }
      ],
      minWarmupCandles: 15
    }
  },
  {
    name: "Liquidity Grab Scalper",
    description: "Trades liquidity sweeps and reversals. Catches stop hunts for 0.5-1% moves.",
    category: "SCALPING",
    timeframes: ["3m", "5m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Liquidity Grab Scalper",
      description: "Liquidity sweep scalping strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 35 },
          { type: "indicator", name: "RSI", period: 14, operator: "CROSS_ABOVE", value: 35 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 20 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 65 },
          { type: "indicator", name: "RSI", period: 14, operator: "CROSS_BELOW", value: 65 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 20 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.5 },
        target: { type: "PERCENTAGE", value: 1.0 },
        trailingSL: { enabled: true, activationPercent: 0.6, trailPercent: 0.3 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.5 },
        target: { type: "PERCENTAGE", value: 1.0 },
        trailingSL: { enabled: true, activationPercent: 0.6, trailPercent: 0.3 }
      },
      requiredIndicators: [
        { name: "RSI", period: 14 },
        { name: "EMA", period: 20 }
      ],
      minWarmupCandles: 20
    }
  },

  // ===== INTRADAY STRATEGIES (5) =====
  {
    name: "Trend Following Intraday",
    description: "Rides intraday trends with trailing stops. Targets 1-2% moves with trend confirmation.",
    category: "INTRADAY",
    timeframes: ["5m", "15m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Trend Following Intraday",
      description: "Intraday trend following strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 20 },
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 9, operator: ">", indicator2: "EMA", indicator2Period: 21 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 25 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 20 },
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 9, operator: "<", indicator2: "EMA", indicator2Period: 21 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 25 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 1.0 },
        target: { type: "PERCENTAGE", value: 2.0 },
        trailingSL: { enabled: true, activationPercent: 1.0, trailPercent: 0.5 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 1.0 },
        target: { type: "PERCENTAGE", value: 2.0 },
        trailingSL: { enabled: true, activationPercent: 1.0, trailPercent: 0.5 }
      },
      requiredIndicators: [
        { name: "EMA", period: 9 },
        { name: "EMA", period: 20 },
        { name: "EMA", period: 21 },
        { name: "ADX", period: 14 }
      ],
      minWarmupCandles: 25
    }
  },
  {
    name: "Opening Range Breakout",
    description: "Trades first 15-min range breakouts. Targets 1.5-3% moves with volume confirmation.",
    category: "INTRADAY",
    timeframes: ["5m", "15m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Opening Range Breakout",
      description: "Opening range breakout strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "BB_UPPER" },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 60 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 20 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "BB_LOWER" },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 40 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 20 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 1.2 },
        target: { type: "PERCENTAGE", value: 2.5 },
        trailingSL: { enabled: true, activationPercent: 1.5, trailPercent: 0.7 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 1.2 },
        target: { type: "PERCENTAGE", value: 2.5 },
        trailingSL: { enabled: true, activationPercent: 1.5, trailPercent: 0.7 }
      },
      requiredIndicators: [
        { name: "BB_UPPER", period: 20 },
        { name: "BB_LOWER", period: 20 },
        { name: "RSI", period: 14 },
        { name: "ADX", period: 14 }
      ],
      minWarmupCandles: 20
    }
  },
  {
    name: "VWAP Mean Reversion",
    description: "Fades extremes back to VWAP. Targets 1-1.5% mean reversion moves.",
    category: "INTRADAY",
    timeframes: ["5m", "15m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "VWAP Mean Reversion",
      description: "VWAP mean reversion strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "VWAP" },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 40 },
          { type: "indicator", name: "RSI", period: 14, operator: "CROSS_ABOVE", value: 35 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "VWAP" },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 60 },
          { type: "indicator", name: "RSI", period: 14, operator: "CROSS_BELOW", value: 65 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.8 },
        target: { type: "PERCENTAGE", value: 1.5 },
        trailingSL: { enabled: true, activationPercent: 1.0, trailPercent: 0.4 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 0.8 },
        target: { type: "PERCENTAGE", value: 1.5 },
        trailingSL: { enabled: true, activationPercent: 1.0, trailPercent: 0.4 }
      },
      requiredIndicators: [
        { name: "VWAP" },
        { name: "RSI", period: 14 }
      ],
      minWarmupCandles: 20
    }
  },
  {
    name: "Supply Demand Zones",
    description: "Trades institutional order blocks. Targets 1.5-2.5% moves from key zones.",
    category: "INTRADAY",
    timeframes: ["15m", "30m"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Supply Demand Zones",
      description: "Supply demand zone strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 50 },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 50 },
          { type: "price_action", action: "BULLISH_CANDLE" }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 50 },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 50 },
          { type: "price_action", action: "BEARISH_CANDLE" }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 1.0 },
        target: { type: "PERCENTAGE", value: 2.0 },
        trailingSL: { enabled: true, activationPercent: 1.2, trailPercent: 0.6 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 1.0 },
        target: { type: "PERCENTAGE", value: 2.0 },
        trailingSL: { enabled: true, activationPercent: 1.2, trailPercent: 0.6 }
      },
      requiredIndicators: [
        { name: "EMA", period: 50 },
        { name: "RSI", period: 14 }
      ],
      minWarmupCandles: 50
    }
  },
  {
    name: "Multi-Timeframe Confluence",
    description: "Aligns 5m, 15m, 1h for high-probability setups. Targets 2-3% moves.",
    category: "INTRADAY",
    timeframes: ["5m", "15m", "1h"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Multi-Timeframe Confluence",
      description: "Multi-timeframe confluence strategy",
      version: 1,
      strategyType: "INTRADAY",
      buy: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 20, operator: ">", indicator2: "EMA", indicator2Period: 50 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 20 },
          { type: "indicator", name: "MACD_HIST", operator: ">", value: 0 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 25 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 20, operator: "<", indicator2: "EMA", indicator2Period: 50 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 20 },
          { type: "indicator", name: "MACD_HIST", operator: "<", value: 0 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 25 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 1.5 },
        target: { type: "PERCENTAGE", value: 3.0 },
        trailingSL: { enabled: true, activationPercent: 1.8, trailPercent: 0.8 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 1.5 },
        target: { type: "PERCENTAGE", value: 3.0 },
        trailingSL: { enabled: true, activationPercent: 1.8, trailPercent: 0.8 }
      },
      requiredIndicators: [
        { name: "EMA", period: 20 },
        { name: "EMA", period: 50 },
        { name: "MACD" },
        { name: "ADX", period: 14 }
      ],
      minWarmupCandles: 50
    }
  },

  // ===== SWING STRATEGIES (5) =====
  {
    name: "Swing Trend Momentum",
    description: "Multi-day trend following with momentum confirmation. Targets 3-5% moves over 2-5 days.",
    category: "SWING",
    timeframes: ["1h", "4h", "1d"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Swing Trend Momentum",
      description: "Swing trend momentum strategy",
      version: 1,
      strategyType: "SWING",
      buy: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 20, operator: ">", indicator2: "EMA", indicator2Period: 50 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 20 },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 55 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 25 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 20, operator: "<", indicator2: "EMA", indicator2Period: 50 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 20 },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 45 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 25 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 2.5 },
        target: { type: "PERCENTAGE", value: 5.0 },
        trailingSL: { enabled: true, activationPercent: 3.0, trailPercent: 1.5 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 2.5 },
        target: { type: "PERCENTAGE", value: 5.0 },
        trailingSL: { enabled: true, activationPercent: 3.0, trailPercent: 1.5 }
      },
      requiredIndicators: [
        { name: "EMA", period: 20 },
        { name: "EMA", period: 50 },
        { name: "RSI", period: 14 },
        { name: "ADX", period: 14 }
      ],
      minWarmupCandles: 50
    }
  },
  {
    name: "Breakout Retest Swing",
    description: "Trades retests of major breakout levels. Targets 4-7% moves with high win rate.",
    category: "SWING",
    timeframes: ["4h", "1d"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Breakout Retest Swing",
      description: "Breakout retest swing strategy",
      version: 1,
      strategyType: "SWING",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "BB_UPPER" },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 60 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 30 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "BB_LOWER" },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 40 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 30 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 3.0 },
        target: { type: "PERCENTAGE", value: 6.0 },
        trailingSL: { enabled: true, activationPercent: 4.0, trailPercent: 2.0 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 3.0 },
        target: { type: "PERCENTAGE", value: 6.0 },
        trailingSL: { enabled: true, activationPercent: 4.0, trailPercent: 2.0 }
      },
      requiredIndicators: [
        { name: "BB_UPPER", period: 20 },
        { name: "BB_LOWER", period: 20 },
        { name: "RSI", period: 14 },
        { name: "ADX", period: 14 }
      ],
      minWarmupCandles: 30
    }
  },
  {
    name: "Moving Average Crossover Swing",
    description: "Classic EMA crossover with trend filters. Targets 3-6% moves with high reliability.",
    category: "SWING",
    timeframes: ["4h", "1d"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Moving Average Crossover Swing",
      description: "MA crossover swing strategy",
      version: 1,
      strategyType: "SWING",
      buy: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 9, operator: "CROSS_ABOVE", indicator2: "EMA", indicator2Period: 21 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 50 },
          { type: "indicator", name: "MACD_HIST", operator: ">", value: 0 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 9, operator: "CROSS_BELOW", indicator2: "EMA", indicator2Period: 21 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 50 },
          { type: "indicator", name: "MACD_HIST", operator: "<", value: 0 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 2.5 },
        target: { type: "PERCENTAGE", value: 5.0 },
        trailingSL: { enabled: true, activationPercent: 3.5, trailPercent: 1.5 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 2.5 },
        target: { type: "PERCENTAGE", value: 5.0 },
        trailingSL: { enabled: true, activationPercent: 3.5, trailPercent: 1.5 }
      },
      requiredIndicators: [
        { name: "EMA", period: 9 },
        { name: "EMA", period: 21 },
        { name: "EMA", period: 50 },
        { name: "MACD" }
      ],
      minWarmupCandles: 50
    }
  },
  {
    name: "Support Resistance Swing",
    description: "Swings between major S/R levels with confirmation. Targets 4-8% moves.",
    category: "SWING",
    timeframes: ["4h", "1d"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Support Resistance Swing",
      description: "S/R swing strategy",
      version: 1,
      strategyType: "SWING",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 50 },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 50 },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 70 },
          { type: "price_action", action: "BULLISH_CANDLE" }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 50 },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 50 },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 30 },
          { type: "price_action", action: "BEARISH_CANDLE" }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 3.0 },
        target: { type: "PERCENTAGE", value: 6.5 },
        trailingSL: { enabled: true, activationPercent: 4.0, trailPercent: 2.0 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 3.0 },
        target: { type: "PERCENTAGE", value: 6.5 },
        trailingSL: { enabled: true, activationPercent: 4.0, trailPercent: 2.0 }
      },
      requiredIndicators: [
        { name: "EMA", period: 50 },
        { name: "RSI", period: 14 }
      ],
      minWarmupCandles: 50
    }
  },
  {
    name: "Momentum Breakout Swing",
    description: "Catches strong momentum moves with volume confirmation. Targets 5-10% moves.",
    category: "SWING",
    timeframes: ["1d"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Momentum Breakout Swing",
      description: "Momentum breakout swing strategy",
      version: 1,
      strategyType: "SWING",
      buy: {
        logic: "AND",
        rules: [
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 65 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 30 },
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 20, operator: ">", indicator2: "EMA", indicator2Period: 50 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "BB_UPPER" }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 35 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 30 },
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 20, operator: "<", indicator2: "EMA", indicator2Period: 50 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "BB_LOWER" }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 4.0 },
        target: { type: "PERCENTAGE", value: 8.0 },
        trailingSL: { enabled: true, activationPercent: 5.0, trailPercent: 2.5 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 4.0 },
        target: { type: "PERCENTAGE", value: 8.0 },
        trailingSL: { enabled: true, activationPercent: 5.0, trailPercent: 2.5 }
      },
      requiredIndicators: [
        { name: "RSI", period: 14 },
        { name: "ADX", period: 14 },
        { name: "EMA", period: 20 },
        { name: "EMA", period: 50 },
        { name: "BB_UPPER", period: 20 },
        { name: "BB_LOWER", period: 20 }
      ],
      minWarmupCandles: 50
    }
  },

  // ===== INVESTMENT STRATEGIES (5) =====
  {
    name: "Long-Term Trend Investor",
    description: "Follows major market trends for weeks/months. Targets 10-20% moves with wide stops.",
    category: "INVESTMENT",
    timeframes: ["1d", "1w"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Long-Term Trend Investor",
      description: "Long-term trend investment strategy",
      version: 1,
      strategyType: "POSITIONAL",
      buy: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 50, operator: ">", indicator2: "EMA", indicator2Period: 200 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 50 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 25 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 50, operator: "<", indicator2: "EMA", indicator2Period: 200 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 50 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 25 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 8.0 },
        target: { type: "PERCENTAGE", value: 15.0 },
        trailingSL: { enabled: true, activationPercent: 10.0, trailPercent: 5.0 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 8.0 },
        target: { type: "PERCENTAGE", value: 15.0 },
        trailingSL: { enabled: true, activationPercent: 10.0, trailPercent: 5.0 }
      },
      requiredIndicators: [
        { name: "EMA", period: 50 },
        { name: "EMA", period: 200 },
        { name: "ADX", period: 14 }
      ],
      minWarmupCandles: 200
    }
  },
  {
    name: "Value Accumulation Investor",
    description: "Accumulates on dips in uptrends. Targets 12-25% moves with patience.",
    category: "INVESTMENT",
    timeframes: ["1d", "1w"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Value Accumulation Investor",
      description: "Value accumulation investment strategy",
      version: 1,
      strategyType: "POSITIONAL",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 200 },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 45 },
          { type: "indicator", name: "RSI", period: 14, operator: "CROSS_ABOVE", value: 40 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 200 },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 55 },
          { type: "indicator", name: "RSI", period: 14, operator: "CROSS_BELOW", value: 60 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 10.0 },
        target: { type: "PERCENTAGE", value: 20.0 },
        trailingSL: { enabled: true, activationPercent: 12.0, trailPercent: 6.0 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 10.0 },
        target: { type: "PERCENTAGE", value: 20.0 },
        trailingSL: { enabled: true, activationPercent: 12.0, trailPercent: 6.0 }
      },
      requiredIndicators: [
        { name: "EMA", period: 200 },
        { name: "RSI", period: 14 }
      ],
      minWarmupCandles: 200
    }
  },
  {
    name: "Breakout Position Builder",
    description: "Builds positions on major breakouts. Targets 15-30% moves over months.",
    category: "INVESTMENT",
    timeframes: ["1d", "1w"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Breakout Position Builder",
      description: "Breakout position building strategy",
      version: 1,
      strategyType: "POSITIONAL",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "BB_UPPER" },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 30 },
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 50, operator: ">", indicator2: "EMA", indicator2Period: 200 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "BB_LOWER" },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 30 },
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 50, operator: "<", indicator2: "EMA", indicator2Period: 200 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 12.0 },
        target: { type: "PERCENTAGE", value: 25.0 },
        trailingSL: { enabled: true, activationPercent: 15.0, trailPercent: 7.0 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 12.0 },
        target: { type: "PERCENTAGE", value: 25.0 },
        trailingSL: { enabled: true, activationPercent: 15.0, trailPercent: 7.0 }
      },
      requiredIndicators: [
        { name: "BB_UPPER", period: 20 },
        { name: "BB_LOWER", period: 20 },
        { name: "ADX", period: 14 },
        { name: "EMA", period: 50 },
        { name: "EMA", period: 200 }
      ],
      minWarmupCandles: 200
    }
  },
  {
    name: "Dividend Momentum Investor",
    description: "Combines value and momentum for long holds. Targets 10-18% with dividends.",
    category: "INVESTMENT",
    timeframes: ["1d", "1w"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Dividend Momentum Investor",
      description: "Dividend momentum investment strategy",
      version: 1,
      strategyType: "POSITIONAL",
      buy: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 100 },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 50 },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 65 },
          { type: "indicator", name: "MACD_HIST", operator: ">", value: 0 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 100 },
          { type: "indicator", name: "RSI", period: 14, operator: "<", value: 50 },
          { type: "indicator", name: "RSI", period: 14, operator: ">", value: 35 },
          { type: "indicator", name: "MACD_HIST", operator: "<", value: 0 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 8.0 },
        target: { type: "PERCENTAGE", value: 15.0 },
        trailingSL: { enabled: true, activationPercent: 10.0, trailPercent: 5.0 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 8.0 },
        target: { type: "PERCENTAGE", value: 15.0 },
        trailingSL: { enabled: true, activationPercent: 10.0, trailPercent: 5.0 }
      },
      requiredIndicators: [
        { name: "EMA", period: 100 },
        { name: "RSI", period: 14 },
        { name: "MACD" }
      ],
      minWarmupCandles: 100
    }
  },
  {
    name: "Market Cycle Investor",
    description: "Adapts to market cycles for optimal entries. Targets 12-22% moves.",
    category: "INVESTMENT",
    timeframes: ["1d", "1w"],
    instruments: [NIFTY_50_TOKEN, BANKNIFTY_TOKEN],
    executable_strategy: {
      name: "Market Cycle Investor",
      description: "Market cycle investment strategy",
      version: 1,
      strategyType: "POSITIONAL",
      buy: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 20, operator: "CROSS_ABOVE", indicator2: "EMA", indicator2Period: 50 },
          { type: "price_vs_indicator", priceField: "close", operator: ">", indicator: "EMA", indicatorPeriod: 200 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 20 }
        ]
      },
      sell: {
        logic: "AND",
        rules: [
          { type: "indicator_vs_indicator", indicator1: "EMA", indicator1Period: 20, operator: "CROSS_BELOW", indicator2: "EMA", indicator2Period: 50 },
          { type: "price_vs_indicator", priceField: "close", operator: "<", indicator: "EMA", indicatorPeriod: 200 },
          { type: "indicator", name: "ADX", period: 14, operator: ">", value: 20 }
        ]
      },
      buyExit: {
        stopLoss: { type: "PERCENTAGE", value: 10.0 },
        target: { type: "PERCENTAGE", value: 18.0 },
        trailingSL: { enabled: true, activationPercent: 12.0, trailPercent: 6.0 }
      },
      sellExit: {
        stopLoss: { type: "PERCENTAGE", value: 10.0 },
        target: { type: "PERCENTAGE", value: 18.0 },
        trailingSL: { enabled: true, activationPercent: 12.0, trailPercent: 6.0 }
      },
      requiredIndicators: [
        { name: "EMA", period: 20 },
        { name: "EMA", period: 50 },
        { name: "EMA", period: 200 },
        { name: "ADX", period: 14 }
      ],
      minWarmupCandles: 200
    }
  }
];

async function createStrategies() {
  console.log('🚀 Starting strategy creation...\n');

  for (const strategy of strategies) {
    try {
      console.log(`Creating: ${strategy.name} (${strategy.category})`);

      // Insert strategy into database
      const { data, error } = await supabaseAdmin
        .from('strategies')
        .insert({
          user_id: ADMIN_USER_ID,
          name: strategy.name,
          description: strategy.description,
          type: 'custom',
          category: strategy.category,
          executable_strategy: strategy.executable_strategy,
          selected_timeframes: strategy.timeframes,
          selected_instruments: strategy.instruments,
          is_finalized: true,
          admin_approved: true,
          visibility: 'public',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating ${strategy.name}:`, error.message);
        continue;
      }

      console.log(`✅ Created: ${strategy.name} (ID: ${data.id})\n`);
    } catch (err) {
      console.error(`❌ Exception creating ${strategy.name}:`, err);
    }
  }

  console.log('\n🎉 Strategy creation complete!');
  console.log(`\nCreated ${strategies.length} strategies:`);
  console.log(`- 5 Scalping strategies`);
  console.log(`- 5 Intraday strategies`);
  console.log(`- 5 Swing strategies`);
  console.log(`- 5 Investment strategies`);
}

// Run the script
createStrategies()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
