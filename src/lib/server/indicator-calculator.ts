
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
    let ema = data[0]; // Start with first value
    
    // For a better EMA, we should seed it with an SMA
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    ema = sum / period;
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
    const ema2 = this.calculateEMA(ema1.map(v => isNaN(v) ? 0 : v), period); // Avoid filtering
    
    const results: number[] = new Array(data.length).fill(NaN);
    for (let i = period * 2 - 2; i < data.length; i++) {
      results[i] = 2 * ema1[i] - ema2[i];
    }
    return results;
  }

  static calculateVWAP(candles: Candle[]): number[] {
    const results: number[] = new Array(candles.length).fill(NaN);
    let cumulativePV = 0;
    let cumulativeV = 0;
    let lastDate = "";

    for (let i = 0; i < candles.length; i++) {
      const date = new Date(candles[i].timestamp).toDateString();
      if (date !== lastDate) {
        cumulativePV = 0;
        cumulativeV = 0;
        lastDate = date;
      }
      const pv = ((candles[i].high + candles[i].low + candles[i].close) / 3) * candles[i].volume;
      cumulativePV += pv;
      cumulativeV += candles[i].volume;
      results[i] = cumulativePV / cumulativeV;
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
    
    // Calculate signal line manually to keep indices aligned
    const results: number[] = new Array(data.length).fill(NaN);
    const multiplier = 2 / (signal + 1);
    
    let firstValid = -1;
    for(let i=0; i<macdLine.length; i++) {
      if(!isNaN(macdLine[i])) {
        firstValid = i;
        break;
      }
    }

    if (firstValid !== -1 && macdLine.length > firstValid + signal) {
      let sum = 0;
      for (let i = firstValid; i < firstValid + signal; i++) sum += macdLine[i];
      let sig = sum / signal;
      results[firstValid + signal - 1] = sig;

      for (let i = firstValid + signal; i < macdLine.length; i++) {
        sig = (macdLine[i] - sig) * multiplier + sig;
        results[i] = sig;
      }
    }

    return { 
      macd: macdLine, 
      signal: results, 
      histogram: macdLine.map((m, i) => m - results[i]) 
    };
  }

  static calculateADX(candles: Candle[], period: number = 14): number[] {
    const results: number[] = new Array(candles.length).fill(NaN);
    if (candles.length < period * 2) return results;

    const plusDM: number[] = new Array(candles.length).fill(0);
    const minusDM: number[] = new Array(candles.length).fill(0);
    const tr: number[] = new Array(candles.length).fill(0);

    for (let i = 1; i < candles.length; i++) {
      const highDiff = candles[i].high - candles[i - 1].high;
      const lowDiff = candles[i - 1].low - candles[i].low;
      
      plusDM[i] = (highDiff > lowDiff && highDiff > 0) ? highDiff : 0;
      minusDM[i] = (lowDiff > highDiff && lowDiff > 0) ? lowDiff : 0;
      tr[i] = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
    }

    const smoothedPlusDM = this.calculateEMA(plusDM, period);
    const smoothedMinusDM = this.calculateEMA(minusDM, period);
    const smoothedTR = this.calculateEMA(tr, period);

    const dx: number[] = new Array(candles.length).fill(0);
    for (let i = period; i < candles.length; i++) {
      const plusDI = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
      const minusDI = (smoothedMinusDM[i] / smoothedTR[i]) * 100;
      dx[i] = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    }

    const adx = this.calculateEMA(dx, period);
    return adx;
  }

  static calculateStochastic(candles: Candle[], period: number = 14, kPeriod: number = 3, dPeriod: number = 3): { k: number[]; d: number[] } {
    const rawK: number[] = new Array(candles.length).fill(NaN);
    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      const low = Math.min(...slice.map(c => c.low));
      const high = Math.max(...slice.map(c => c.high));
      rawK[i] = ((candles[i].close - low) / (high - low)) * 100;
    }
    const k = this.calculateSMA(rawK.map(v => isNaN(v) ? 0 : v), kPeriod).map((v, i) => isNaN(rawK[i]) ? NaN : v);
    const d = this.calculateSMA(k.map(v => isNaN(v) ? 0 : v), dPeriod).map((v, i) => isNaN(k[i]) ? NaN : v);

    return { k, d };
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
      
      // Seed with basic values if first calculation
      if (i === period) {
        upperBand[i] = basicUpper;
        lowerBand[i] = basicLower;
      } else {
        upperBand[i] = (basicUpper < upperBand[i - 1] || candles[i - 1].close > upperBand[i - 1]) ? basicUpper : upperBand[i - 1];
        lowerBand[i] = (basicLower > lowerBand[i - 1] || candles[i - 1].close < lowerBand[i - 1]) ? basicLower : lowerBand[i - 1];
      }
      
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
    const range = candle.high - candle.low;
    if (range === 0) return false;
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    return lowerWick > body * 2 && upperWick < body * 0.5;
  }

  static isShootingStar(candle: Candle): boolean {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    if (range === 0) return false;
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
    if (range === 0) return body === 0;
    return body < range * 0.1;
  }
}
