
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
    
    // Better EMA seed: SMA of first 'period' values
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    ema = sum / period;
    results[period - 1] = ema;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
      results[i] = ema;
    }
    return results;
  }

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

    const calculateRsiValue = (gain: number, loss: number) => {
      if (loss === 0) return 100;
      const rs = gain / loss;
      return 100 - 100 / (1 + rs);
    };

    results[period] = calculateRsiValue(avgGain, avgLoss);

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      results[i] = calculateRsiValue(avgGain, avgLoss);
    }

    return results;
  }

  static calculateMACD(data: number[], fast: number = 12, slow: number = 26, signal: number = 9): { macd: number[]; signal: number[]; histogram: number[] } {
    const fastEma = this.calculateEMA(data, fast);
    const slowEma = this.calculateEMA(data, slow);
    
    const macdLine = fastEma.map((f, i) => f - slowEma[i]);
    const signalLine = this.calculateEMA(macdLine.filter(v => !isNaN(v)), signal);
    
    // Align signal line back to original length
    const alignedSignal: number[] = new Array(data.length).fill(NaN);
    const offset = macdLine.findIndex(v => !isNaN(v)) + signal - 1;
    for (let i = 0; i < signalLine.length; i++) {
      if (i + offset < data.length) {
        alignedSignal[i + offset] = signalLine[i];
      }
    }

    const histogram = macdLine.map((m, i) => m - alignedSignal[i]);

    return { macd: macdLine, signal: alignedSignal, histogram };
  }

  static calculateATR(candles: Candle[], period: number = 14): number[] {
    const tr: number[] = new Array(candles.length).fill(0);
    tr[0] = candles[0].high - candles[0].low;

    for (let i = 1; i < candles.length; i++) {
      const h_l = candles[i].high - candles[i].low;
      const h_pc = Math.abs(candles[i].high - candles[i - 1].close);
      const l_pc = Math.abs(candles[i].low - candles[i - 1].close);
      tr[i] = Math.max(h_l, h_pc, l_pc);
    }

    return this.calculateSMA(tr, period); // Wilders uses SMMA which is similar to EMA, but SMA is often used
  }

  static calculateBollingerBands(data: number[], period: number = 20, stdDev: number = 2): { middle: number[]; upper: number[]; lower: number[] } {
    const middle = this.calculateSMA(data, period);
    const upper: number[] = new Array(data.length).fill(NaN);
    const lower: number[] = new Array(data.length).fill(NaN);

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const squareDiffs = slice.map(v => Math.pow(v - mean, 2));
      const variance = squareDiffs.reduce((a, b) => a + b, 0) / period;
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
      const basicUpperBand = (candles[i].high + candles[i].low) / 2 + multiplier * atr[i];
      const basicLowerBand = (candles[i].high + candles[i].low) / 2 - multiplier * atr[i];

      upperBand[i] = (basicUpperBand < upperBand[i - 1] || candles[i - 1].close > upperBand[i - 1]) 
        ? basicUpperBand 
        : upperBand[i - 1];
        
      lowerBand[i] = (basicLowerBand > lowerBand[i - 1] || candles[i - 1].close < lowerBand[i - 1])
        ? basicLowerBand
        : lowerBand[i - 1];

      if (i > 0) {
        direction[i] = direction[i - 1];
        if (direction[i - 1] === 1 && candles[i].close <= lowerBand[i]) {
          direction[i] = -1;
        } else if (direction[i - 1] === -1 && candles[i].close >= upperBand[i]) {
          direction[i] = 1;
        }
      }

      trend[i] = direction[i] === 1 ? lowerBand[i] : upperBand[i];
    }

    return { trend, direction };
  }

  // Candlestick Pattern Detection
  static isHammer(candle: Candle, prevCandle: Candle | null): boolean {
    const body = Math.abs(candle.close - candle.open);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    
    return lowerWick > body * 2 && upperWick < body * 0.5;
  }

  static isEngulfing(candle: Candle, prevCandle: Candle): { bullish: boolean; bearish: boolean } {
    const isPrevBearish = prevCandle.close < prevCandle.open;
    const isPrevBullish = prevCandle.close > prevCandle.open;
    const isCurrBearish = candle.close < candle.open;
    const isCurrBullish = candle.close > candle.open;

    const bullish = isPrevBearish && isCurrBullish && candle.open <= prevCandle.close && candle.close >= prevCandle.open;
    const bearish = isPrevBullish && isCurrBearish && candle.open >= prevCandle.close && candle.close <= prevCandle.open;

    return { bullish, bearish };
  }

  static isDoji(candle: Candle): boolean {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    return body < range * 0.1;
  }
}
