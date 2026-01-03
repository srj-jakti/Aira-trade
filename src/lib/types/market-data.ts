export type DataMode = "LIVE" | "BACKTEST";

export interface LiveCandle {
  id?: string;
  instrument_token: number;
  timeframe: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
