
export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type IndicatorResult = number | Record<string, number>;

export class IndicatorCalculator {
  // --- TREND INDICATORS ---

  static calculateSMA(data: number[], period: number): number[] {
    const results: number[] = new Array(data.length).fill(NaN);
    if (data.length < period) return results;

    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    results[period - 1] = sum / period;

    for (let i = period; i < data.length; i++) {
      sum = sum - data[i - period] + data[i];
      results[i] = sum / period;
    }
    return results;
  }

  static calculateEMA(data: number[], period: number): number[] {
    const results: number[] = new Array(data.length).fill(NaN);
    if (data.length < period) return results;

    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    let ema = sum / period;
    results[period - 1] = ema;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
      results[i] = ema;
    }
    return results;
  }

  static calculateWMA(data: number[], period: number): number[] {
    const results: number[] = new Array(data.length).fill(NaN);
    if (data.length < period) return results;

    const weightSum = (period * (period + 1)) / 2;

    for (let i = period - 1; i < data.length; i++) {
      let weightedSum = 0;
      for (let j = 0; j < period; j++) {
        weightedSum += data[i - j] * (period - j);
      }
      results[i] = weightedSum / weightSum;
    }
    return results;
  }

  static calculateDEMA(data: number[], period: number): number[] {
    const ema1 = this.calculateEMA(data, period);
    const ema2 = this.calculateEMA(ema1.filter(v => !isNaN(v)), period);
    
    const results: number[] = new Array(data.length).fill(NaN);
    const offset = (period - 1) * 2;
    
    for (let i = offset; i < data.length; i++) {
      const e1 = ema1[i];
      const e2 = ema2[i - (period - 1)];
      results[i] = 2 * e1 - e2;
    }
    return results;
  }

  // --- MOMENTUM INDICATORS ---

  static calculateRSI(data: number[], period: number = 14): number[] {
    const results: number[] = new Array(data.length).fill(NaN);
    if (data.length <= period) return results;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = data[i] - data[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    const calc = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
    results[period] = calc(avgGain, avgLoss);

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      results[i] = calc(avgGain, avgLoss);
    }
    return results;
  }

  static calculateMACD(data: number[], fast: number = 12, slow: number = 26, signal: number = 9): { macd: number[]; signal: number[]; histogram: number[] } {
    const fastEma = this.calculateEMA(data, fast);
    const slowEma = this.calculateEMA(data, slow);
    const macdLine = fastEma.map((f, i) => f - slowEma[i]);
    const signalLine = this.calculateEMA(macdLine.filter(v => !isNaN(v)), signal);
    
    const alignedSignal: number[] = new Array(data.length).fill(NaN);
    const offset = slow - 1 + signal - 1;
    for (let i = 0; i < signalLine.length; i++) {
      if (i + offset < data.length) alignedSignal[i + offset] = signalLine[i];
    }
    return { macd: macdLine, signal: alignedSignal, histogram: macdLine.map((m, i) => m - alignedSignal[i]) };
  }

  static calculateStochastic(candles: Candle[], period: number = 14, kPeriod: number = 3, dPeriod: number = 3): { k: number[]; d: number[] } {
    const k: number[] = new Array(candles.length).fill(NaN);
    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      const low = Math.min(...slice.map(c => c.low));
      const high = Math.max(...slice.map(c => c.high));
      k[i] = ((candles[i].close - low) / (high - low)) * 100;
    }
    const smoothK = this.calculateSMA(k.filter(v => !isNaN(v)), kPeriod);
    const d = this.calculateSMA(smoothK, dPeriod);

    const alignedK: number[] = new Array(candles.length).fill(NaN);
    const alignedD: number[] = new Array(candles.length).fill(NaN);
    const offsetK = period - 1 + kPeriod - 1;
    const offsetD = offsetK + dPeriod - 1;

    for(let i=0; i<smoothK.length; i++) if(i+offsetK < candles.length) alignedK[i+offsetK] = smoothK[i];
    for(let i=0; i<d.length; i++) if(i+offsetD < candles.length) alignedD[i+offsetD] = d[i];

    return { k: alignedK, d: alignedD };
  }

  // --- VOLATILITY INDICATORS ---

  static calculateATR(candles: Candle[], period: number = 14): number[] {
    const tr: number[] = new Array(candles.length).fill(0);
    tr[0] = candles[0].high - candles[0].low;
    for (let i = 1; i < candles.length; i++) {
      tr[i] = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close));
    }
    return this.calculateSMA(tr, period);
  }

  static calculateBollingerBands(data: number[], period: number = 20, stdDev: number = 2): { middle: number[]; upper: number[]; lower: number[] } {
    const middle = this.calculateSMA(data, period);
    const upper: number[] = new Array(data.length).fill(NaN);
    const lower: number[] = new Array(data.length).fill(NaN);
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const dev = Math.sqrt(variance) * stdDev;
      upper[i] = mean + dev;
      lower[i] = mean - dev;
    }
    return { middle, upper, lower };
  }

  static calculateSupertrend(candles: Candle[], period: number = 10, multiplier: number = 3): { trend: number[]; direction: (1 | -1)[] } {
    const atr = this.calculateATR(candles, period);
    const trend: number[] = new Array(candles.length).fill(NaN);
    const direction: (1 | -1)[] = new Array(candles.length).fill(1);
    const upperBand: number[] = new Array(candles.length).fill(0);
    const lowerBand: number[] = new Array(candles.length).fill(0);

    for (let i = period; i < candles.length; i++) {
      const basicUpper = (candles[i].high + candles[i].low) / 2 + multiplier * atr[i];
      const basicLower = (candles[i].high + candles[i].low) / 2 - multiplier * atr[i];
      upperBand[i] = (basicUpper < upperBand[i - 1] || candles[i - 1].close > upperBand[i - 1]) ? basicUpper : upperBand[i - 1];
      lowerBand[i] = (basicLower > lowerBand[i - 1] || candles[i - 1].close < lowerBand[i - 1]) ? basicLower : lowerBand[i - 1];
      direction[i] = direction[i - 1];
      if (direction[i - 1] === 1 && candles[i].close <= lowerBand[i]) direction[i] = -1;
      else if (direction[i - 1] === -1 && candles[i].close >= upperBand[i]) direction[i] = 1;
      trend[i] = direction[i] === 1 ? lowerBand[i] : upperBand[i];
    }
    return { trend, direction };
  }

  // --- VOLUME INDICATORS ---

  static calculateOBV(candles: Candle[]): number[] {
    const results: number[] = new Array(candles.length).fill(0);
    results[0] = candles[0].volume;
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].close > candles[i - 1].close) results[i] = results[i - 1] + candles[i].volume;
      else if (candles[i].close < candles[i - 1].close) results[i] = results[i - 1] - candles[i].volume;
      else results[i] = results[i - 1];
    }
    return results;
  }

  // --- PATTERN DETECTION ---

  static isHammer(candle: Candle, prevCandle: Candle | null): boolean {
    const body = Math.abs(candle.close - candle.open);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    return lowerWick > body * 2 && upperWick < body * 0.5;
  }

  static isShootingStar(candle: Candle): boolean {
    const body = Math.abs(candle.close - candle.open);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    return upperWick > body * 2 && lowerWick < body * 0.5;
  }

  static isEngulfing(candle: Candle, prevCandle: Candle): { bullish: boolean; bearish: boolean } {
    const isPrevBearish = prevCandle.close < prevCandle.open;
    const isPrevBullish = prevCandle.close > prevCandle.open;
    const isCurrBearish = candle.close < candle.open;
    const isCurrBullish = candle.close > candle.open;
    return {
      bullish: isPrevBearish && isCurrBullish && candle.open <= prevCandle.close && candle.close >= prevCandle.open,
      bearish: isPrevBullish && isCurrBearish && candle.open >= prevCandle.close && candle.close <= prevCandle.open
    };
  }

  static isDoji(candle: Candle): boolean {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    return body < range * 0.1;
  }
}
