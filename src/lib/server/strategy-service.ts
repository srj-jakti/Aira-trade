import { supabaseAdmin } from "@/lib/supabase/admin";
import { aiSharedService } from "./ai-shared-service";
import { marketDataEngine } from "./market-data-engine";
import { decrypt } from "./encryption";
import { IndicatorCalculator, type Candle as CalcCandle } from "./indicator-calculator";

export interface StrategyLogic {
  conditions: string[];
  indicators?: string[];
  parameters?: Record<string, number | string>;
  description?: string;
}

export interface StructuredStrategy {
  name: string;
  description: string;
  buy_entry_logic: StrategyLogic;
  buy_stop_loss: StrategyLogic;
  buy_target: StrategyLogic;
  buy_trailing_sl: StrategyLogic;
  sell_entry_logic: StrategyLogic;
  sell_stop_loss: StrategyLogic;
  sell_target: StrategyLogic;
  sell_trailing_sl: StrategyLogic;
  hold_logic: StrategyLogic;
}

export interface BacktestResult {
  capital_used: number;
  total_trades: number;
  buy_count: number;
  sell_count: number;
  hold_count: number;
  net_pnl: number;
  net_pnl_percentage: number;
  win_rate: number;
  loss_rate: number;
  max_drawdown: number;
  max_drawdown_percentage: number;
  trade_log: TradeEntry[];
  data_source: string;
  candle_count: number;
  date_range: { from: string; to: string };
}

export interface TradeEntry {
  id: string;
  type: "BUY" | "SELL";
  entry_time: string;
  entry_price: number;
  exit_time?: string;
  exit_price?: number;
  quantity: number;
  pnl?: number;
  pnl_percentage?: number;
  exit_reason?: string;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TIMEFRAME_LOOKBACK: Record<string, { days: number; label: string }> = {
  "1m": { days: 60, label: "60 Days" },
  "3m": { days: 100, label: "100 Days" },
  "5m": { days: 100, label: "100 Days" },
  "15m": { days: 200, label: "200 Days" },
  "30m": { days: 400, label: "400 Days" },
  "1h": { days: 400, label: "400 Days" },
  "day": { days: 2000, label: "5 Years" },
  "3minute": { days: 100, label: "100 Days" },
  "5minute": { days: 100, label: "100 Days" },
  "15minute": { days: 200, label: "200 Days" },
  "60minute": { days: 400, label: "400 Days" },
};

function normalizeTimeframe(tf: string): string {
  const aliases: Record<string, string> = {
    "1d": "day",
    "day": "day",
    "D": "day",
    "1w": "week",
    "week": "week",
    "3minute": "3m",
    "5minute": "5m",
    "15minute": "15m",
    "60minute": "1h",
  };
  return aliases[tf] || tf;
}

function getZerodhaInterval(timeframe: string): string {
  const intervalMap: Record<string, string> = {
    "1m": "minute",
    "3m": "3minute",
    "5m": "5minute",
    "15m": "15minute",
    "30m": "30minute",
    "1h": "60minute",
    "day": "day",
  };
  const normalized = normalizeTimeframe(timeframe);
  return intervalMap[normalized] || "5minute";
}

class StrategyService {
  private static instance: StrategyService;

  private constructor() {}

  static getInstance(): StrategyService {
    if (!StrategyService.instance) {
      StrategyService.instance = new StrategyService();
    }
    return StrategyService.instance;
  }

  async formatStrategyWithAI(rawInput: string): Promise<StructuredStrategy> {
    const messages = [
      {
        role: "system",
        content: `You are an expert trading strategy formatter. Your job is to take ANY user input and convert it into a fully structured, executable trading strategy.
  
  CRITICAL: You MUST use the following technical indicators, candlestick patterns, and chart patterns when defining the entry/exit conditions. Use their exact names.
  
  TRADING TOOLS AVAILABLE:
  - Trend: SMA, EMA, WMA, HMA, Supertrend, ADX, Ichimoku, VWAP, Alligator
  - Momentum: RSI, MACD, Stochastic, CCI, Williams %R, MFI, ROC, Awesome Oscillator
  - Volatility: Bollinger Bands, ATR, Keltner Channel, Donchian Channel
  - Patterns: Hammer, Shooting Star, Doji, Engulfing, Morning Star, Harami, H&S, Double Top/Bottom
  - Price Action: Swing High/Low, Trend Lines, Breakout, FVG, Order Block, Liquidity Sweep
  
  RULES:
  1. ALWAYS provide specific buy_entry_logic, sell_entry_logic, stop_loss, and target.
  2. If the user is vague, infer the most professional parameters (e.g., RSI period 14, SMA period 20).
  3. Support multi-instrument logic if requested.
  
  OUTPUT FORMAT (JSON):
  {
    "name": "Strategy Name",
    "description": "Professional description",
    "buy_entry_logic": { "conditions": ["RSI(14) below 30", "Price above SMA(20)"], "indicators": ["RSI", "SMA"] },
    "sell_entry_logic": { "conditions": ["RSI(14) above 70", "Price below SMA(20)"], "indicators": ["RSI", "SMA"] },
    "buy_stop_loss": { "parameters": { "percentage": 2 } },
    "buy_target": { "parameters": { "percentage": 4 } },
    "hold_logic": { "conditions": ["Volume below 100000"] }
  }`,
      },

      {
        role: "user",
        content: `Convert this trading idea into a complete strategy:\n\n${rawInput}`,
      },
    ];

    const result = await aiSharedService.executeAnalysis("strategy_format", messages, {
      maxTokens: 2000,
      skipCache: true,
    });

    if (!result.success || !result.result) {
      throw new Error("AI failed to format strategy");
    }

    try {
      const parsed = typeof result.result === "string" 
        ? JSON.parse(result.result.replace(/```json\n?|\n?```/g, "").trim())
        : result.result;
      return parsed as StructuredStrategy;
    } catch {
      throw new Error("Failed to parse AI response");
    }
  }

  async improveStrategyWithAI(
    strategy: StructuredStrategy,
    backtestResults: BacktestResult
  ): Promise<{ improved: StructuredStrategy; notes: string }> {
    const messages = [
      {
        role: "system",
        content: `You are an expert trading strategy optimizer. Analyze the given strategy and its backtest results, then provide an IMPROVED version.

Focus on:
1. Entry/exit timing optimization
2. Stop loss and target adjustments based on win/loss patterns
3. Filter improvements to reduce false signals
4. Trailing stop loss optimization
5. Hold/no-trade condition refinements

OUTPUT FORMAT (JSON):
{
  "improved": { <same structure as input strategy with improvements> },
  "notes": "Detailed explanation of what was changed and why"
}`,
      },
      {
        role: "user",
        content: `Improve this strategy based on backtest results:

CURRENT STRATEGY:
${JSON.stringify(strategy, null, 2)}

BACKTEST RESULTS:
- Total Trades: ${backtestResults.total_trades}
- Win Rate: ${backtestResults.win_rate}%
- Loss Rate: ${backtestResults.loss_rate}%
- Net P&L: ${backtestResults.net_pnl} (${backtestResults.net_pnl_percentage}%)
- Max Drawdown: ${backtestResults.max_drawdown} (${backtestResults.max_drawdown_percentage}%)
- Buy Count: ${backtestResults.buy_count}
- Sell Count: ${backtestResults.sell_count}

TRADE LOG SUMMARY:
${JSON.stringify(backtestResults.trade_log.slice(0, 10), null, 2)}`,
      },
    ];

    const result = await aiSharedService.executeAnalysis("strategy_improve", messages, {
      maxTokens: 3000,
      skipCache: true,
    });

    if (!result.success || !result.result) {
      throw new Error("AI failed to improve strategy");
    }

    try {
      const parsed = typeof result.result === "string"
        ? JSON.parse(result.result.replace(/```json\n?|\n?```/g, "").trim())
        : result.result;
      return parsed as { improved: StructuredStrategy; notes: string };
    } catch {
      throw new Error("Failed to parse AI improvement response");
    }
  }

  private async fetchCandlesFromZerodha(
    instrumentToken: number,
    timeframe: string,
    fromDate: Date,
    toDate: Date,
    zerodhaConfigId?: string
  ): Promise<Candle[]> {
    try {
      let config = null;
      if (zerodhaConfigId) {
        const { data } = await supabaseAdmin
          .from("admin_zerodha_configs")
          .select("*")
          .eq("id", zerodhaConfigId)
          .single();
        config = data;
      } else {
        config = await marketDataEngine.getActiveConfig();
      }

      if (!config || !config.access_token) {
        console.log("[StrategyService] No valid Zerodha config found", zerodhaConfigId ? `for ID ${zerodhaConfigId}` : "");
        return [];
      }

      const apiKey = decrypt(config.api_key);
      const accessToken = decrypt(config.access_token);
      const interval = getZerodhaInterval(timeframe);
      const fromStr = fromDate.toISOString().split("T")[0];
      const toStr = toDate.toISOString().split("T")[0];

      console.log(`[StrategyService] Fetching from Zerodha: ${instrumentToken} ${interval} from ${fromStr} to ${toStr}`);

      const response = await fetch(
        `https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}?from=${fromStr}&to=${toStr}`,
        {
          headers: {
            "X-Kite-Version": "3",
            Authorization: `token ${apiKey}:${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        console.error("[StrategyService] Zerodha API error:", error);
        return [];
      }

      const data = await response.json();
      const rawCandles = data.data?.candles || [];

      console.log(`[StrategyService] Got ${rawCandles.length} candles from Zerodha`);

      const candles: Candle[] = rawCandles.map((c: (string | number)[]) => ({
        timestamp: c[0] as string,
        open: c[1] as number,
        high: c[2] as number,
        low: c[3] as number,
        close: c[4] as number,
        volume: c[5] as number,
      }));

      if (candles.length > 0) {
        const normalizedTf = normalizeTimeframe(timeframe);
        const rows = candles.map(c => ({
          instrument_token: instrumentToken,
          timeframe: normalizedTf,
          timestamp: new Date(c.timestamp).toISOString(),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          oi: 0,
        }));

        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          await supabaseAdmin
            .from("live_candles")
            .upsert(batch, { onConflict: "instrument_token,timeframe,timestamp" });
        }
        console.log(`[StrategyService] Cached ${rows.length} candles in live_candles`);
      }

      return candles;
    } catch (error) {
      console.error("[StrategyService] Error fetching from Zerodha:", error);
      return [];
    }
  }

  async runBacktest(
    strategy: StructuredStrategy,
    instrumentTokens: number[],
    timeframe: string,
    capital: number = 100000,
    fromDate?: Date,
    toDate?: Date,
    zerodhaConfigId?: string
  ): Promise<BacktestResult> {
    if (instrumentTokens.length === 0) {
      throw new Error("At least one instrument is required for backtesting");
    }
    if (instrumentTokens.length > 2) {
      throw new Error("Maximum 2 instruments allowed per backtest");
    }

    const lookback = TIMEFRAME_LOOKBACK[timeframe] || TIMEFRAME_LOOKBACK[normalizeTimeframe(timeframe)] || { days: 100 };
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - lookback.days * 24 * 60 * 60 * 1000);
    
    const from = fromDate || defaultFrom;
    const to = toDate || now;
    const normalizedTf = normalizeTimeframe(timeframe);

    let allCandles: Candle[] = [];
    let dataSource = "live_candles";

    for (const instrumentToken of instrumentTokens) {
      const { data: liveCandles, error } = await supabaseAdmin
        .from("live_candles")
        .select("*")
        .eq("instrument_token", instrumentToken)
        .eq("timeframe", normalizedTf)
        .gte("timestamp", from.toISOString())
        .lte("timestamp", to.toISOString())
        .order("timestamp", { ascending: true });

      let candles: Candle[] = [];

      if (!error && liveCandles && liveCandles.length > 0) {
        candles = liveCandles.map(c => ({
          timestamp: c.timestamp,
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: parseInt(c.volume) || 0,
        }));
        console.log(`[StrategyService] Found ${candles.length} candles in live_candles for ${instrumentToken}`);
      }

        if (candles.length < 50) {
          console.log(`[StrategyService] Insufficient data in live_candles (${candles.length}), fetching from Zerodha...`);
          const zerodhaCandles = await this.fetchCandlesFromZerodha(instrumentToken, timeframe, from, to, zerodhaConfigId);
          if (zerodhaCandles.length > candles.length) {
            candles = zerodhaCandles;
            dataSource = "zerodha_api";
          }
        }


      allCandles = allCandles.concat(candles);
    }

    if (allCandles.length === 0) {
      throw new Error("No data available for backtesting. Please ensure market data is available.");
    }

    allCandles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const result = this.executeBacktest(strategy, allCandles, capital);
    
    return {
      ...result,
      data_source: dataSource,
      candle_count: allCandles.length,
      date_range: {
        from: allCandles[0]?.timestamp || from.toISOString(),
        to: allCandles[allCandles.length - 1]?.timestamp || to.toISOString(),
      },
    };
  }

  private executeBacktest(
    strategy: StructuredStrategy,
    candles: Candle[],
    capital: number
  ): BacktestResult {
    const trades: TradeEntry[] = [];
    let currentPosition: TradeEntry | null = null;
    let cashBalance = capital;
    let peakBalance = capital;
    let maxDrawdown = 0;
    let wins = 0;
    let losses = 0;

    // Pre-calculate indicators for the entire series
    const indicatorData: Record<string, any> = {};
    const closePrices = candles.map(c => c.close);
    const highPrices = candles.map(c => c.high);
    const lowPrices = candles.map(c => c.low);

    // Common indicators often used
    indicatorData["rsi_14"] = IndicatorCalculator.calculateRSI(closePrices, 14);
    indicatorData["sma_20"] = IndicatorCalculator.calculateSMA(closePrices, 20);
    indicatorData["sma_50"] = IndicatorCalculator.calculateSMA(closePrices, 50);
    indicatorData["sma_200"] = IndicatorCalculator.calculateSMA(closePrices, 200);
    indicatorData["ema_9"] = IndicatorCalculator.calculateEMA(closePrices, 9);
    indicatorData["ema_21"] = IndicatorCalculator.calculateEMA(closePrices, 21);
    
    const macd = IndicatorCalculator.calculateMACD(closePrices);
    indicatorData["macd_line"] = macd.macd;
    indicatorData["macd_signal"] = macd.signal;
    indicatorData["macd_hist"] = macd.histogram;

    const bb = IndicatorCalculator.calculateBollingerBands(closePrices);
    indicatorData["bb_upper"] = bb.upper;
    indicatorData["bb_middle"] = bb.middle;
    indicatorData["bb_lower"] = bb.lower;

    const st = IndicatorCalculator.calculateSupertrend(candles as CalcCandle[]);
    indicatorData["supertrend"] = st.trend;
    indicatorData["supertrend_dir"] = st.direction;

    const checkCondition = (condition: string, index: number): boolean => {
      const lowerCond = condition.toLowerCase();
      const candle = candles[index];
      const prevCandle = index > 0 ? candles[index - 1] : null;

      // 1. RSI Conditions
      if (lowerCond.includes("rsi")) {
        const rsi = indicatorData["rsi_14"][index];
        if (isNaN(rsi)) return false;
        
        if (lowerCond.includes("below") || lowerCond.includes("<")) {
          const threshold = parseInt(lowerCond.match(/\d+/)?.[0] || "30");
          return rsi < threshold;
        }
        if (lowerCond.includes("above") || lowerCond.includes(">")) {
          const threshold = parseInt(lowerCond.match(/\d+/)?.[0] || "70");
          return rsi > threshold;
        }
        if (lowerCond.includes("crosses above")) {
          const threshold = parseInt(lowerCond.match(/\d+/)?.[0] || "30");
          const prevRsi = indicatorData["rsi_14"][index - 1];
          return prevRsi < threshold && rsi >= threshold;
        }
      }

      // 2. MA Crossovers / Price vs MA
      if (lowerCond.includes("sma") || lowerCond.includes("ema")) {
        const type = lowerCond.includes("sma") ? "sma" : "ema";
        const period = parseInt(lowerCond.match(/\d+/)?.[0] || "20");
        const key = `${type}_${period}`;
        
        // Ensure indicator is calculated
        if (!indicatorData[key]) {
          indicatorData[key] = type === "sma" 
            ? IndicatorCalculator.calculateSMA(closePrices, period)
            : IndicatorCalculator.calculateEMA(closePrices, period);
        }

        const maValue = indicatorData[key][index];
        if (isNaN(maValue)) return false;

        if (lowerCond.includes("price") && (lowerCond.includes("above") || lowerCond.includes(">"))) {
          return candle.close > maValue;
        }
        if (lowerCond.includes("price") && (lowerCond.includes("below") || lowerCond.includes("<"))) {
          return candle.close < maValue;
        }
        if (lowerCond.includes("crosses above")) {
          const prevMa = indicatorData[key][index - 1];
          return prevCandle && prevCandle.close < prevMa && candle.close >= maValue;
        }
      }

      // 3. MACD
      if (lowerCond.includes("macd")) {
        const line = indicatorData["macd_line"][index];
        const signal = indicatorData["macd_signal"][index];
        if (isNaN(line) || isNaN(signal)) return false;

        if (lowerCond.includes("crosses above signal")) {
          const prevLine = indicatorData["macd_line"][index - 1];
          const prevSignal = indicatorData["macd_signal"][index - 1];
          return prevLine < prevSignal && line >= signal;
        }
      }

      // 4. Supertrend
      if (lowerCond.includes("supertrend")) {
        const dir = indicatorData["supertrend_dir"][index];
        if (lowerCond.includes("bullish") || lowerCond.includes("buy")) {
          return dir === 1;
        }
        if (lowerCond.includes("bearish") || lowerCond.includes("sell")) {
          return dir === -1;
        }
      }

      // 5. Candlestick Patterns
      if (lowerCond.includes("hammer")) {
        return IndicatorCalculator.isHammer(candle as CalcCandle, prevCandle as CalcCandle);
      }
      if (lowerCond.includes("engulfing")) {
        if (!prevCandle) return false;
        const res = IndicatorCalculator.isEngulfing(candle as CalcCandle, prevCandle as CalcCandle);
        return lowerCond.includes("bullish") ? res.bullish : res.bearish;
      }
      if (lowerCond.includes("doji")) {
        return IndicatorCalculator.isDoji(candle as CalcCandle);
      }

      // 6. Simple Price Action
      if (lowerCond.includes("bullish candle")) return candle.close > candle.open;
      if (lowerCond.includes("bearish candle")) return candle.close < candle.open;
      
      return false;
    };

    const checkAllConditions = (conditions: string[], index: number): boolean => {
      if (!conditions || conditions.length === 0) return false;
      return conditions.every(c => checkCondition(c, index));
    };

    for (let i = 20; i < candles.length; i++) {
      const candle = candles[i];
      const prevCandle = candles[i - 1];

      if (currentPosition) {
        const entryPrice = currentPosition.entry_price;
        let shouldExit = false;
        let exitReason = "";
        let exitPrice = candle.close;

        if (currentPosition.type === "BUY") {
          // Stop Loss
          const slParams = strategy.buy_stop_loss.parameters || {};
          const slPercent = (slParams.percentage as number) || 2;
          const slPrice = entryPrice * (1 - slPercent / 100);
          
          if (candle.low <= slPrice) {
            shouldExit = true;
            exitReason = "Stop Loss Hit";
            exitPrice = slPrice;
          }

          // Target
          const targetParams = strategy.buy_target.parameters || {};
          const targetPercent = (targetParams.percentage as number) || 4;
          const targetPrice = entryPrice * (1 + targetPercent / 100);

          if (candle.high >= targetPrice && !shouldExit) {
            shouldExit = true;
            exitReason = "Target Hit";
            exitPrice = targetPrice;
          }

          // Sell Signal (Reverse Entry)
          if (checkAllConditions(strategy.sell_entry_logic.conditions, i) && !shouldExit) {
            shouldExit = true;
            exitReason = "Sell Signal";
          }
        } else {
          // SELL Position Logic
          const slParams = strategy.sell_stop_loss.parameters || {};
          const slPercent = (slParams.percentage as number) || 2;
          const slPrice = entryPrice * (1 + slPercent / 100);

          if (candle.high >= slPrice) {
            shouldExit = true;
            exitReason = "Stop Loss Hit";
            exitPrice = slPrice;
          }

          const targetParams = strategy.sell_target.parameters || {};
          const targetPercent = (targetParams.percentage as number) || 4;
          const targetPrice = entryPrice * (1 - targetPercent / 100);

          if (candle.low <= targetPrice && !shouldExit) {
            shouldExit = true;
            exitReason = "Target Hit";
            exitPrice = targetPrice;
          }

          if (checkAllConditions(strategy.buy_entry_logic.conditions, i) && !shouldExit) {
            shouldExit = true;
            exitReason = "Buy Signal";
          }
        }

        if (shouldExit) {
          const pnl = currentPosition.type === "BUY"
            ? (exitPrice - entryPrice) * currentPosition.quantity
            : (entryPrice - exitPrice) * currentPosition.quantity;

          currentPosition.exit_time = candle.timestamp;
          currentPosition.exit_price = exitPrice;
          currentPosition.pnl = pnl;
          currentPosition.pnl_percentage = (pnl / (entryPrice * currentPosition.quantity)) * 100;
          currentPosition.exit_reason = exitReason;

          cashBalance += pnl;
          if (pnl > 0) wins++;
          else losses++;

          if (cashBalance > peakBalance) peakBalance = cashBalance;
          const drawdown = peakBalance - cashBalance;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;

          trades.push(currentPosition);
          currentPosition = null;
        }
      }

      if (!currentPosition) {
        const holdConditions = strategy.hold_logic.conditions || [];
        const shouldHold = holdConditions.length > 0 && checkAllConditions(holdConditions, i);

        if (!shouldHold) {
          if (checkAllConditions(strategy.buy_entry_logic.conditions, i)) {
            const quantity = Math.floor((cashBalance * 0.95) / candle.close);
            if (quantity > 0) {
              currentPosition = {
                id: `trade-${trades.length + 1}`,
                type: "BUY",
                entry_time: candle.timestamp,
                entry_price: candle.close,
                quantity,
              };
            }
          } else if (checkAllConditions(strategy.sell_entry_logic.conditions, i)) {
            const quantity = Math.floor((cashBalance * 0.95) / candle.close);
            if (quantity > 0) {
              currentPosition = {
                id: `trade-${trades.length + 1}`,
                type: "SELL",
                entry_time: candle.timestamp,
                entry_price: candle.close,
                quantity,
              };
            }
          }
        }
      }
    }

    if (currentPosition) {
      const lastCandle = candles[candles.length - 1];
      const pnl = currentPosition.type === "BUY"
        ? (lastCandle.close - currentPosition.entry_price) * currentPosition.quantity
        : (currentPosition.entry_price - lastCandle.close) * currentPosition.quantity;

      currentPosition.exit_time = lastCandle.timestamp;
      currentPosition.exit_price = lastCandle.close;
      currentPosition.pnl = pnl;
      currentPosition.pnl_percentage = (pnl / (currentPosition.entry_price * currentPosition.quantity)) * 100;
      currentPosition.exit_reason = "End of Data";

      cashBalance += pnl;
      if (pnl > 0) wins++;
      else losses++;

      trades.push(currentPosition);
    }

    const totalTrades = trades.length;
    const netPnl = cashBalance - capital;
    const buyCount = trades.filter(t => t.type === "BUY").length;
    const sellCount = trades.filter(t => t.type === "SELL").length;

    return {
      capital_used: capital,
      total_trades: totalTrades,
      buy_count: buyCount,
      sell_count: sellCount,
      hold_count: candles.length - 20 - totalTrades,
      net_pnl: netPnl,
      net_pnl_percentage: (netPnl / capital) * 100,
      win_rate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      loss_rate: totalTrades > 0 ? (losses / totalTrades) * 100 : 0,
      max_drawdown: maxDrawdown,
      max_drawdown_percentage: (maxDrawdown / peakBalance) * 100,
      trade_log: trades,
      data_source: "pending",
      candle_count: 0,
      date_range: { from: "", to: "" },
    };
  }

  async getAvailableTimeframes(instrumentToken: number): Promise<string[]> {
    const { data } = await supabaseAdmin
      .from("live_candles")
      .select("timeframe")
      .eq("instrument_token", instrumentToken)
      .limit(1000);

    if (!data) return [];

    const timeframes = new Set(data.map(d => d.timeframe));
    return Array.from(timeframes);
  }

  async saveStrategy(
    userId: string,
    strategy: StructuredStrategy,
    rawInput: string,
    selectedTimeframes: string[],
    visibility: "private" | "public" | "invite_only"
  ): Promise<number> {
    // 1. Create or Update strategy
    const { data, error } = await supabaseAdmin
      .from("strategies")
      .insert({
        user_id: userId,
        name: strategy.name,
        description: strategy.description,
        raw_input: rawInput,
        buy_entry_logic: strategy.buy_entry_logic,
        buy_stop_loss: strategy.buy_stop_loss,
        buy_target: strategy.buy_target,
        buy_trailing_sl: strategy.buy_trailing_sl,
        sell_entry_logic: strategy.sell_entry_logic,
        sell_stop_loss: strategy.sell_stop_loss,
        sell_target: strategy.sell_target,
        sell_trailing_sl: strategy.sell_trailing_sl,
        hold_logic: strategy.hold_logic,
        selected_timeframes: selectedTimeframes,
        visibility,
        is_finalized: true,
        status: "finalized",
        version: 1,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("Failed to save strategy");
    }

    // 2. Save version snapshot
    await this.saveVersionSnapshot(data.id, 1, strategy);

    return data.id;
  }

  async updateStrategy(
    strategyId: number,
    strategy: StructuredStrategy,
    selectedTimeframes?: string[]
  ): Promise<void> {
    // 1. Get current version
    const { data: current } = await supabaseAdmin
      .from("strategies")
      .select("version")
      .eq("id", strategyId)
      .single();

    const newVersion = (current?.version || 1) + 1;

    // 2. Update strategy
    const { error } = await supabaseAdmin
      .from("strategies")
      .update({
        name: strategy.name,
        description: strategy.description,
        buy_entry_logic: strategy.buy_entry_logic,
        buy_stop_loss: strategy.buy_stop_loss,
        buy_target: strategy.buy_target,
        buy_trailing_sl: strategy.buy_trailing_sl,
        sell_entry_logic: strategy.sell_entry_logic,
        sell_stop_loss: strategy.sell_stop_loss,
        sell_target: strategy.sell_target,
        sell_trailing_sl: strategy.sell_trailing_sl,
        hold_logic: strategy.hold_logic,
        selected_timeframes: selectedTimeframes,
        version: newVersion,
        improvement_count: (current?.improvement_count || 0) + 1,
      })
      .eq("id", strategyId);

    if (error) throw new Error("Failed to update strategy");

    // 3. Save version snapshot
    await this.saveVersionSnapshot(strategyId, newVersion, strategy);
  }

  private async saveVersionSnapshot(
    strategyId: number,
    version: number,
    strategy: StructuredStrategy
  ): Promise<void> {
    await supabaseAdmin.from("strategy_versions").insert({
      strategy_id: strategyId,
      version: version,
      buy_entry_logic: strategy.buy_entry_logic,
      buy_stop_loss: strategy.buy_stop_loss,
      buy_target: strategy.buy_target,
      buy_trailing_sl: strategy.buy_trailing_sl,
      sell_entry_logic: strategy.sell_entry_logic,
      sell_stop_loss: strategy.sell_stop_loss,
      sell_target: strategy.sell_target,
      sell_trailing_sl: strategy.sell_trailing_sl,
      hold_logic: strategy.hold_logic,
    });
  }

  async saveBacktestResult(
    strategyId: number,
    version: number,
    instrumentTokens: number[],
    timeframe: string,
    result: BacktestResult,
    strategySnapshot: StructuredStrategy
  ): Promise<void> {
    await supabaseAdmin.from("strategy_backtests").insert({
      strategy_id: strategyId,
      strategy_version: version,
      instrument_token: instrumentTokens[0],
      timeframe,
      ...result,
      strategy_snapshot: strategySnapshot,
    });
  }

  async getUserStrategies(userId: string): Promise<unknown[]> {
    const { data } = await supabaseAdmin
      .from("strategies")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return data || [];
  }

  async getPublicStrategies(): Promise<unknown[]> {
    const { data } = await supabaseAdmin
      .from("strategies")
      .select(`
        id, name, description, visibility, is_active,
        selected_timeframes, created_at, user_id,
        profiles:user_id (username, avatar_url)
      `)
      .eq("admin_approved", true)
      .in("visibility", ["public", "invite_only"])
      .order("created_at", { ascending: false });

    return (data || []).map(s => ({
      ...s,
      buy_entry_logic: s.visibility === "invite_only" ? null : undefined,
      sell_entry_logic: s.visibility === "invite_only" ? null : undefined,
    }));
  }

  async checkAccess(strategyId: number, userId: string): Promise<boolean> {
    const { data: strategy } = await supabaseAdmin
      .from("strategies")
      .select("user_id, visibility")
      .eq("id", strategyId)
      .single();

    if (!strategy) return false;
    if (strategy.user_id === userId) return true;
    if (strategy.visibility === "public") return true;

    if (strategy.visibility === "invite_only") {
      const { data: grant } = await supabaseAdmin
        .from("strategy_access_grants")
        .select("id, expires_at, is_revoked")
        .eq("strategy_id", strategyId)
        .eq("user_id", userId)
        .single();

      if (grant && !grant.is_revoked) {
        if (!grant.expires_at || new Date(grant.expires_at) > new Date()) {
          return true;
        }
      }
    }

    return false;
  }
}

export const strategyService = StrategyService.getInstance();
