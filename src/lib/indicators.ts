
export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function calculateSMA(data: Candle[], period: number): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  if (data.length < period) return result;
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }
  return result;
}

export function calculateEMA(data: Candle[], period: number): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  if (data.length < period) return result;
  
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;

  for (let i = period - 1; i < data.length; i++) {
    if (i === period - 1) {
      result.push({ time: data[i].time, value: ema });
    } else {
      ema = data[i].close * k + ema * (1 - k);
      result.push({ time: data[i].time, value: ema });
    }
  }
  return result;
}

export function calculateBollingerBands(data: Candle[], period: number, stdDev: number) {
  const upper: { time: number; value: number }[] = [];
  const lower: { time: number; value: number }[] = [];
  const basis: { time: number; value: number }[] = [];

  if (data.length < period) return { upper, lower, basis };

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const sma = sum / period;
    
    let sumSqDiff = 0;
    for (let j = 0; j < period; j++) {
      sumSqDiff += Math.pow(data[i - j].close - sma, 2);
    }
    const sd = Math.sqrt(sumSqDiff / period);

    basis.push({ time: data[i].time, value: sma });
    upper.push({ time: data[i].time, value: sma + sd * stdDev });
    lower.push({ time: data[i].time, value: sma - sd * stdDev });
  }

  return { upper, lower, basis };
}

export function calculateVWAP(data: Candle[]) {
  const result: { time: number; value: number }[] = [];
  if (!data || data.length === 0) return result;

  let cumVolume = 0;
  let cumPV = 0;
  
  // VWAP typically resets daily, but for simplicity here we calculate continuously 
  // or based on the visible dataset. For intraday correct VWAP, we need session awareness.
  // We will do a simple cumulative VWAP over the loaded data for now.
  
  let currentDay = new Date(data[0].time * 1000).getDate();

  for (let i = 0; i < data.length; i++) {
    const day = new Date(data[i].time * 1000).getDate();
    if (day !== currentDay) {
      cumVolume = 0;
      cumPV = 0;
      currentDay = day;
    }

    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    cumPV += typicalPrice * data[i].volume;
    cumVolume += data[i].volume;

    if (cumVolume === 0) {
      result.push({ time: data[i].time, value: typicalPrice });
    } else {
      result.push({
        time: data[i].time,
        value: cumPV / cumVolume,
      });
    }
  }
  return result;
}

export function calculateSupertrend(data: Candle[], period: number = 10, multiplier: number = 3) {
  const result: { time: number; value: number; color: string; direction: number }[] = [];
  const atr = calculateATR(data, period);
  
  // Need to align ATR with data
  // ATR starts at index `period` (approx)
  
  let prevUpper = 0;
  let prevLower = 0;
  let prevDir = 1; // 1 = Up, -1 = Down

  // We need to iterate from the point where we have ATR
  // ATR array will be shorter than data by `period` elements
  
  // Map ATR by time for easy lookup
  const atrMap = new Map(atr.map(a => [a.time, a.value]));

  for (let i = 0; i < data.length; i++) {
    const time = data[i].time;
    const currentAtr = atrMap.get(time);
    
    if (!currentAtr) continue;

    const hl2 = (data[i].high + data[i].low) / 2;
    let upper = hl2 + multiplier * currentAtr;
    let lower = hl2 - multiplier * currentAtr;

    const prevClose = i > 0 ? data[i - 1].close : data[i].close;

    if (i > 0 && prevUpper && prevClose < prevUpper) {
      upper = Math.min(upper, prevUpper);
    }
    
    if (i > 0 && prevLower && prevClose > prevLower) {
      lower = Math.max(lower, prevLower);
    }

    let dir = prevDir;
    if (data[i].close > prevUpper) {
      dir = 1;
    } else if (data[i].close < prevLower) {
      dir = -1;
    }

    if (prevDir === 1) {
        if (data[i].close < prevLower) dir = -1;
    } else {
        if (data[i].close > prevUpper) dir = 1;
    }

    const value = dir === 1 ? lower : upper;

    result.push({
      time,
      value,
      color: dir === 1 ? '#22c55e' : '#ef4444',
      direction: dir
    });

    prevUpper = upper;
    prevLower = lower;
    prevDir = dir;
  }

  return result;
}

export function calculateRSI(data: Candle[], period: number) {
  const result: { time: number; value: number }[] = [];
  if (data.length < period + 1) return result;

  let gains = 0;
  let losses = 0;

  // First RSI
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));

  result.push({ time: data[period].time, value: rsi });

  // Smoothed RSI
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));

    result.push({ time: data[i].time, value: rsi });
  }

  return result;
}

export function calculateMACD(data: Candle[], fastPeriod: number, slowPeriod: number, signalPeriod: number) {
  const result: { time: number; macd: number; signal: number; histogram: number }[] = [];
  if (data.length < slowPeriod + signalPeriod) return result;

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  // Align EMAs
  const macdLine: { time: number; value: number }[] = [];
  const fastMap = new Map(fastEMA.map(d => [d.time, d.value]));
  const slowMap = new Map(slowEMA.map(d => [d.time, d.value]));

  for (const d of data) {
    const f = fastMap.get(d.time);
    const s = slowMap.get(d.time);
    if (f !== undefined && s !== undefined) {
      macdLine.push({ time: d.time, value: f - s });
    }
  }

  // Calculate Signal Line (EMA of MACD Line)
  // We need to adapt calculateEMA to accept simple value array, or reuse it by mocking Candle structure
  // For simplicity, let's implement a simple EMA for numbers here
  
  const signalLine: { time: number; value: number }[] = [];
  if (macdLine.length < signalPeriod) return result;

  const k = 2 / (signalPeriod + 1);
  let ema = macdLine.slice(0, signalPeriod).reduce((sum, d) => sum + d.value, 0) / signalPeriod;
  
  // Push first signal point
  signalLine.push({ time: macdLine[signalPeriod - 1].time, value: ema });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    ema = macdLine[i].value * k + ema * (1 - k);
    signalLine.push({ time: macdLine[i].time, value: ema });
  }

  // Combine results
  const signalMap = new Map(signalLine.map(d => [d.time, d.value]));
  const macdMap = new Map(macdLine.map(d => [d.time, d.value]));

  for (const d of data) {
    const m = macdMap.get(d.time);
    const s = signalMap.get(d.time);
    if (m !== undefined && s !== undefined) {
      result.push({
        time: d.time,
        macd: m,
        signal: s,
        histogram: m - s
      });
    }
  }

  return result;
}

export function calculateStochastic(data: Candle[], kPeriod: number, dPeriod: number, slowing: number) {
  const result: { time: number; k: number; d: number }[] = [];
  if (data.length < kPeriod + dPeriod) return result;

  const rawK: { time: number; value: number }[] = [];

  for (let i = kPeriod - 1; i < data.length; i++) {
    const window = data.slice(i - kPeriod + 1, i + 1);
    const low = Math.min(...window.map(d => d.low));
    const high = Math.max(...window.map(d => d.high));
    
    let k = 50;
    if (high !== low) {
      k = ((data[i].close - low) / (high - low)) * 100;
    }
    rawK.push({ time: data[i].time, value: k });
  }

  // Apply Slowing (SMA of K) if needed, usually %K is already smoothed or raw
  // Standard Stoch is Fast %K. Slow Stoch is SMA(Fast %K)
  // Let's assume standard Fast Stochastic: %K = raw, %D = SMA(%K)
  // If slowing > 1, we smooth %K first.
  
  let smoothK = rawK;
  if (slowing > 1) {
     // Simple SMA on rawK values
     const smoothed: { time: number; value: number }[] = [];
     for (let i = slowing - 1; i < rawK.length; i++) {
        const sum = rawK.slice(i - slowing + 1, i + 1).reduce((acc, curr) => acc + curr.value, 0);
        smoothed.push({ time: rawK[i].time, value: sum / slowing });
     }
     smoothK = smoothed;
  }

  // Calculate %D (SMA of %K)
  const percentD: { time: number; value: number }[] = [];
  for (let i = dPeriod - 1; i < smoothK.length; i++) {
      const sum = smoothK.slice(i - dPeriod + 1, i + 1).reduce((acc, curr) => acc + curr.value, 0);
      percentD.push({ time: smoothK[i].time, value: sum / dPeriod });
  }

  // Align
  const dMap = new Map(percentD.map(d => [d.time, d.value]));
  
  for (const k of smoothK) {
    const d = dMap.get(k.time);
    if (d !== undefined) {
      result.push({ time: k.time, k: k.value, d });
    }
  }

  return result;
}

export function calculateATR(data: Candle[], period: number) {
  const result: { time: number; value: number }[] = [];
  const trs: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = i > 0 ? data[i - 1].close : data[i].open; // approx for first

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }

  // First ATR is SMA of TR
  let sumTr: number = 0;
  for (let i = 0; i < period; i++) sumTr += trs[i];
  let val: number = sumTr / period;
  
  result.push({ time: data[period - 1].time, value: val });

  // Subsequent are smoothed
  for (let i = period; i < data.length; i++) {
    val = ((val * (period - 1)) + trs[i]) / period;
    result.push({ time: data[i].time, value: val });
  }

  return result;
}
