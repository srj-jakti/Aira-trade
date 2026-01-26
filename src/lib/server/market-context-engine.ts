import { supabaseAdmin } from "@/lib/supabase/admin";

export type MarketRegime = 
  | "STRONG_UPTREND" 
  | "UPTREND" 
  | "SIDEWAYS" 
  | "DOWNTREND" 
  | "STRONG_DOWNTREND"
  | "VOLATILE_BULLISH"
  | "VOLATILE_BEARISH"
  | "CONSOLIDATION"
  | "BREAKOUT_PENDING";

export type VolatilityLevel = "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "EXTREME";
export type VolumeProfile = "VERY_LOW" | "LOW" | "AVERAGE" | "HIGH" | "CLIMACTIC";

export interface MarketContext {
  regime: MarketRegime;
  regimeStrength: number;
  volatility: VolatilityLevel;
  atr: number;
  atrPercent: number;
  trendDirection: "UP" | "DOWN" | "NEUTRAL";
  momentum: number;
  volumeProfile: VolumeProfile;
  keyLevels: {
    supports: number[];
    resistances: number[];
    pivotPoint: number;
  };
  rsi: number;
  macdSignal: "BULLISH" | "BEARISH" | "NEUTRAL";
  emaAlignment: "BULLISH" | "BEARISH" | "MIXED";
  marketPhase: "ACCUMULATION" | "MARKUP" | "DISTRIBUTION" | "MARKDOWN" | "UNCERTAIN";
}

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

class MarketContextEngine {
  private static instance: MarketContextEngine;

  private constructor() {}

  static getInstance(): MarketContextEngine {
    if (!MarketContextEngine.instance) {
      MarketContextEngine.instance = new MarketContextEngine();
    }
    return MarketContextEngine.instance;
  }

  async analyzeMarketContext(
    candles: CandleData[],
    instrumentToken: number,
    timeframe: string
  ): Promise<MarketContext> {
    if (candles.length < 50) {
      return this.getDefaultContext();
    }

    const sortedCandles = [...candles].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const closes = sortedCandles.map(c => c.close);
    const highs = sortedCandles.map(c => c.high);
    const lows = sortedCandles.map(c => c.low);
    const volumes = sortedCandles.map(c => c.volume);

    const atr = this.calculateATR(sortedCandles, 14);
    const currentPrice = closes[closes.length - 1];
    const atrPercent = (atr / currentPrice) * 100;

    const volatility = this.classifyVolatility(atrPercent, timeframe);

    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);
    const ema50 = this.calculateEMA(closes, 50);
    const sma200 = this.calculateSMA(closes, Math.min(200, closes.length));

    const rsi = this.calculateRSI(closes, 14);

    const { macdLine, signalLine } = this.calculateMACD(closes);
    const macdSignal = this.classifyMACD(macdLine, signalLine);

    const emaAlignment = this.classifyEMAAlignment(ema9, ema21, ema50, currentPrice);

    const momentum = this.calculateMomentum(closes);

    const volumeProfile = this.classifyVolume(volumes);

    const trendDirection = this.detectTrendDirection(closes, ema21, ema50);

    const regime = this.detectRegime(
      closes,
      ema9,
      ema21,
      ema50,
      sma200,
      rsi,
      atrPercent,
      momentum,
      volumeProfile
    );

    const regimeStrength = this.calculateRegimeStrength(
      regime,
      emaAlignment,
      momentum,
      rsi,
      volumeProfile
    );

    const keyLevels = this.findKeyLevels(highs, lows, closes);

    const marketPhase = this.detectMarketPhase(
      closes,
      volumes,
      ema21,
      rsi,
      momentum
    );

    const context: MarketContext = {
      regime,
      regimeStrength,
      volatility,
      atr,
      atrPercent,
      trendDirection,
      momentum,
      volumeProfile,
      keyLevels,
      rsi,
      macdSignal,
      emaAlignment,
      marketPhase,
    };

    await this.saveMarketRegime(instrumentToken, timeframe, context);

    return context;
  }

  private calculateATR(candles: CandleData[], period: number): number {
    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const slice = data.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / slice.length;
  }

  private calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(closes: number[]): { macdLine: number; signalLine: number } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;
    
    const macdHistory: number[] = [];
    for (let i = 26; i <= closes.length; i++) {
      const e12 = this.calculateEMA(closes.slice(0, i), 12);
      const e26 = this.calculateEMA(closes.slice(0, i), 26);
      macdHistory.push(e12 - e26);
    }
    
    const signalLine = macdHistory.length >= 9 
      ? this.calculateEMA(macdHistory, 9) 
      : macdLine;

    return { macdLine, signalLine };
  }

  private calculateMomentum(closes: number[], period: number = 10): number {
    if (closes.length < period) return 0;
    const current = closes[closes.length - 1];
    const past = closes[closes.length - period];
    return ((current - past) / past) * 100;
  }

  private classifyVolatility(atrPercent: number, timeframe: string): VolatilityLevel {
    const thresholds: Record<string, { low: number; normal: number; high: number; extreme: number }> = {
      "1m": { low: 0.1, normal: 0.3, high: 0.6, extreme: 1.0 },
      "5m": { low: 0.2, normal: 0.5, high: 1.0, extreme: 1.5 },
      "15m": { low: 0.3, normal: 0.8, high: 1.5, extreme: 2.5 },
      "1h": { low: 0.5, normal: 1.2, high: 2.0, extreme: 3.5 },
      "4h": { low: 0.8, normal: 1.8, high: 3.0, extreme: 5.0 },
      "1d": { low: 1.0, normal: 2.5, high: 4.0, extreme: 7.0 },
    };

    const t = thresholds[timeframe] || thresholds["15m"];

    if (atrPercent < t.low) return "VERY_LOW";
    if (atrPercent < t.normal) return "LOW";
    if (atrPercent < t.high) return "NORMAL";
    if (atrPercent < t.extreme) return "HIGH";
    return "EXTREME";
  }

  private classifyVolume(volumes: number[]): VolumeProfile {
    const avgVolume = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const ratio = currentVolume / avgVolume;

    if (ratio < 0.3) return "VERY_LOW";
    if (ratio < 0.7) return "LOW";
    if (ratio < 1.5) return "AVERAGE";
    if (ratio < 2.5) return "HIGH";
    return "CLIMACTIC";
  }

  private classifyMACD(macdLine: number, signalLine: number): "BULLISH" | "BEARISH" | "NEUTRAL" {
    const diff = macdLine - signalLine;
    const threshold = Math.abs(macdLine) * 0.1;
    
    if (diff > threshold) return "BULLISH";
    if (diff < -threshold) return "BEARISH";
    return "NEUTRAL";
  }

  private classifyEMAAlignment(
    ema9: number,
    ema21: number,
    ema50: number,
    price: number
  ): "BULLISH" | "BEARISH" | "MIXED" {
    const bullishAlignment = price > ema9 && ema9 > ema21 && ema21 > ema50;
    const bearishAlignment = price < ema9 && ema9 < ema21 && ema21 < ema50;

    if (bullishAlignment) return "BULLISH";
    if (bearishAlignment) return "BEARISH";
    return "MIXED";
  }

  private detectTrendDirection(
    closes: number[],
    ema21: number,
    ema50: number
  ): "UP" | "DOWN" | "NEUTRAL" {
    const price = closes[closes.length - 1];
    const priceAboveEma21 = price > ema21;
    const ema21AboveEma50 = ema21 > ema50;

    const recentCloses = closes.slice(-10);
    const higherHighs = recentCloses.filter((c, i) => i > 0 && c > recentCloses[i - 1]).length;
    const lowerLows = recentCloses.filter((c, i) => i > 0 && c < recentCloses[i - 1]).length;

    if (priceAboveEma21 && ema21AboveEma50 && higherHighs >= 5) return "UP";
    if (!priceAboveEma21 && !ema21AboveEma50 && lowerLows >= 5) return "DOWN";
    return "NEUTRAL";
  }

  private detectRegime(
    closes: number[],
    ema9: number,
    ema21: number,
    ema50: number,
    sma200: number,
    rsi: number,
    atrPercent: number,
    momentum: number,
    volumeProfile: VolumeProfile
  ): MarketRegime {
    const price = closes[closes.length - 1];
    
    const bullishEMAs = ema9 > ema21 && ema21 > ema50 && price > ema9;
    const bearishEMAs = ema9 < ema21 && ema21 < ema50 && price < ema9;
    
    const aboveSMA200 = price > sma200;
    const isVolatile = atrPercent > 2.0;
    const strongMomentum = Math.abs(momentum) > 3;

    const recentCloses = closes.slice(-20);
    const high20 = Math.max(...recentCloses);
    const low20 = Math.min(...recentCloses);
    const range20 = high20 - low20;
    const rangePercent = (range20 / low20) * 100;
    const isConsolidating = rangePercent < 3 && !strongMomentum;

    const nearHigh = price > high20 * 0.98;
    const nearLow = price < low20 * 1.02;
    const volumeIncreasing = volumeProfile === "HIGH" || volumeProfile === "CLIMACTIC";

    if (isConsolidating && volumeIncreasing) {
      return "BREAKOUT_PENDING";
    }

    if (bullishEMAs && aboveSMA200 && momentum > 5 && rsi > 60) {
      return "STRONG_UPTREND";
    }

    if (bullishEMAs && aboveSMA200 && momentum > 0) {
      return "UPTREND";
    }

    if (bearishEMAs && !aboveSMA200 && momentum < -5 && rsi < 40) {
      return "STRONG_DOWNTREND";
    }

    if (bearishEMAs && !aboveSMA200 && momentum < 0) {
      return "DOWNTREND";
    }

    if (isVolatile && momentum > 2) {
      return "VOLATILE_BULLISH";
    }

    if (isVolatile && momentum < -2) {
      return "VOLATILE_BEARISH";
    }

    if (isConsolidating) {
      return "CONSOLIDATION";
    }

    return "SIDEWAYS";
  }

  private calculateRegimeStrength(
    regime: MarketRegime,
    emaAlignment: "BULLISH" | "BEARISH" | "MIXED",
    momentum: number,
    rsi: number,
    volumeProfile: VolumeProfile
  ): number {
    let strength = 50;

    if (regime.includes("STRONG")) strength += 20;
    else if (regime === "SIDEWAYS" || regime === "CONSOLIDATION") strength -= 10;

    if (
      (regime.includes("UP") && emaAlignment === "BULLISH") ||
      (regime.includes("DOWN") && emaAlignment === "BEARISH")
    ) {
      strength += 15;
    }

    strength += Math.min(15, Math.abs(momentum) * 2);

    if ((regime.includes("UP") && rsi > 50) || (regime.includes("DOWN") && rsi < 50)) {
      strength += 10;
    }

    if (volumeProfile === "HIGH" || volumeProfile === "CLIMACTIC") {
      strength += 10;
    }

    return Math.min(100, Math.max(0, strength));
  }

  private findKeyLevels(
    highs: number[],
    lows: number[],
    closes: number[]
  ): { supports: number[]; resistances: number[]; pivotPoint: number } {
    const recentHighs = highs.slice(-50);
    const recentLows = lows.slice(-50);
    const recentCloses = closes.slice(-50);

    const currentPrice = closes[closes.length - 1];
    const high = Math.max(...recentHighs);
    const low = Math.min(...recentLows);
    const close = recentCloses[recentCloses.length - 1];

    const pivotPoint = (high + low + close) / 3;
    const r1 = 2 * pivotPoint - low;
    const r2 = pivotPoint + (high - low);
    const s1 = 2 * pivotPoint - high;
    const s2 = pivotPoint - (high - low);

    const supports = [s1, s2, low].filter(s => s < currentPrice).sort((a, b) => b - a);
    const resistances = [r1, r2, high].filter(r => r > currentPrice).sort((a, b) => a - b);

    return { supports, resistances, pivotPoint };
  }

  private detectMarketPhase(
    closes: number[],
    volumes: number[],
    ema21: number,
    rsi: number,
    momentum: number
  ): "ACCUMULATION" | "MARKUP" | "DISTRIBUTION" | "MARKDOWN" | "UNCERTAIN" {
    const price = closes[closes.length - 1];
    const avgVolume = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;

    const priceNearLow = price < ema21 * 0.95;
    const priceNearHigh = price > ema21 * 1.05;
    const highVolume = volumeRatio > 1.5;

    if (priceNearLow && highVolume && rsi < 40 && momentum > -2) {
      return "ACCUMULATION";
    }

    if (price > ema21 && momentum > 2 && rsi > 50 && rsi < 70) {
      return "MARKUP";
    }

    if (priceNearHigh && highVolume && rsi > 60 && momentum < 2) {
      return "DISTRIBUTION";
    }

    if (price < ema21 && momentum < -2 && rsi < 50) {
      return "MARKDOWN";
    }

    return "UNCERTAIN";
  }

  private getDefaultContext(): MarketContext {
    return {
      regime: "SIDEWAYS",
      regimeStrength: 50,
      volatility: "NORMAL",
      atr: 0,
      atrPercent: 0,
      trendDirection: "NEUTRAL",
      momentum: 0,
      volumeProfile: "AVERAGE",
      keyLevels: { supports: [], resistances: [], pivotPoint: 0 },
      rsi: 50,
      macdSignal: "NEUTRAL",
      emaAlignment: "MIXED",
      marketPhase: "UNCERTAIN",
    };
  }

  private async saveMarketRegime(
    instrumentToken: number,
    timeframe: string,
    context: MarketContext
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      const tfMinutes: Record<string, number> = {
        "1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240, "1d": 1440
      };
      expiresAt.setMinutes(expiresAt.getMinutes() + (tfMinutes[timeframe] || 15));

      await supabaseAdmin
        .from("market_regimes")
        .upsert({
          instrument_token: instrumentToken,
          timeframe,
          regime: context.regime,
          regime_strength: context.regimeStrength,
          volatility_level: context.volatility,
          atr_value: context.atr,
          trend_direction: context.trendDirection,
          momentum_score: context.momentum,
          volume_profile: context.volumeProfile,
          key_levels: context.keyLevels,
          detected_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        }, { onConflict: "instrument_token,timeframe" });
    } catch (error) {
      console.error("[MarketContextEngine] Failed to save regime:", error);
    }
  }

  async getCachedRegime(
    instrumentToken: number,
    timeframe: string
  ): Promise<MarketContext | null> {
    try {
      const { data } = await supabaseAdmin
        .from("market_regimes")
        .select("*")
        .eq("instrument_token", instrumentToken)
        .eq("timeframe", timeframe)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!data) return null;

      return {
        regime: data.regime as MarketRegime,
        regimeStrength: data.regime_strength,
        volatility: data.volatility_level as VolatilityLevel,
        atr: data.atr_value,
        atrPercent: 0,
        trendDirection: data.trend_direction as "UP" | "DOWN" | "NEUTRAL",
        momentum: data.momentum_score,
        volumeProfile: data.volume_profile as VolumeProfile,
        keyLevels: data.key_levels,
        rsi: 50,
        macdSignal: "NEUTRAL",
        emaAlignment: "MIXED",
        marketPhase: "UNCERTAIN",
      };
    } catch {
      return null;
    }
  }

  isRegimeFavorableForStrategy(
    regime: MarketRegime,
    strategyType: string
  ): { favorable: boolean; score: number; reason: string } {
    const favorabilityMap: Record<string, { regimes: MarketRegime[]; score: number }> = {
      "trend_following": {
        regimes: ["STRONG_UPTREND", "UPTREND", "STRONG_DOWNTREND", "DOWNTREND"],
        score: 90,
      },
      "momentum": {
        regimes: ["STRONG_UPTREND", "STRONG_DOWNTREND", "VOLATILE_BULLISH", "VOLATILE_BEARISH"],
        score: 85,
      },
      "mean_reversion": {
        regimes: ["SIDEWAYS", "CONSOLIDATION"],
        score: 85,
      },
      "breakout": {
        regimes: ["BREAKOUT_PENDING", "CONSOLIDATION"],
        score: 90,
      },
      "scalping": {
        regimes: ["VOLATILE_BULLISH", "VOLATILE_BEARISH", "SIDEWAYS"],
        score: 75,
      },
    };

    const config = favorabilityMap[strategyType] || favorabilityMap["trend_following"];
    const isFavorable = config.regimes.includes(regime);

    return {
      favorable: isFavorable,
      score: isFavorable ? config.score : 30,
      reason: isFavorable
        ? `${regime} is ideal for ${strategyType} strategies`
        : `${regime} is not optimal for ${strategyType} - consider waiting for better conditions`,
    };
  }
}

export const marketContextEngine = MarketContextEngine.getInstance();
