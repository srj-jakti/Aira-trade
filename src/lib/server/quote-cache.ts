import { createClient } from "@supabase/supabase-js";

interface QuoteData {
  instrument_token: number;
  last_price: number;
  change: number;
  change_percent: number;
  volume: number;
  oi: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bid: number;
  ask: number;
  timestamp: string;
}

interface CacheEntry {
  data: QuoteData;
  fetchedAt: number;
}

interface InstrumentInfo {
  tradingsymbol: string;
  exchange: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class QuoteCache {
  private cache = new Map<number, CacheEntry>();
  private pendingTokens = new Set<number>();
  private fetchPromise: Promise<void> | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 900;
  private readonly MIN_FETCH_INTERVAL_MS = 800;
  private instrumentCache = new Map<number, InstrumentInfo>();

  private scannerConfig: { apiKey: string; accessToken: string } | null = null;
  private userConfig: { apiKey: string; accessToken: string } | null = null;

  setConfigs(
    scannerConfig: { apiKey: string; accessToken: string } | null,
    userConfig: { apiKey: string; accessToken: string } | null
  ) {
    this.scannerConfig = scannerConfig;
    this.userConfig = userConfig;
  }

  private async getInstrumentInfo(tokens: number[]): Promise<Map<number, InstrumentInfo>> {
    const result = new Map<number, InstrumentInfo>();
    const tokensToFetch: number[] = [];

    for (const token of tokens) {
      const cached = this.instrumentCache.get(token);
      if (cached) {
        result.set(token, cached);
      } else {
        tokensToFetch.push(token);
      }
    }

    if (tokensToFetch.length > 0) {
      const { data } = await supabase
        .from("instruments")
        .select("instrument_token, tradingsymbol, exchange")
        .in("instrument_token", tokensToFetch);

      if (data) {
        for (const row of data) {
          const info: InstrumentInfo = {
            tradingsymbol: row.tradingsymbol,
            exchange: row.exchange,
          };
          this.instrumentCache.set(Number(row.instrument_token), info);
          result.set(Number(row.instrument_token), info);
        }
      }
    }

    return result;
  }

  async getQuotes(tokens: number[], useScanner = false): Promise<Map<number, QuoteData>> {
    const result = new Map<number, QuoteData>();
    const tokensToFetch: number[] = [];
    const now = Date.now();

    for (const token of tokens) {
      const cached = this.cache.get(token);
      if (cached && now - cached.fetchedAt < this.CACHE_TTL_MS) {
        result.set(token, cached.data);
      } else {
        tokensToFetch.push(token);
        this.pendingTokens.add(token);
      }
    }

    if (tokensToFetch.length > 0) {
      await this.fetchPending(useScanner);

      for (const token of tokensToFetch) {
        const cached = this.cache.get(token);
        if (cached) {
          result.set(token, cached.data);
        }
      }
    }

    return result;
  }

  private async fetchPending(useScanner: boolean): Promise<void> {
    if (this.fetchPromise) {
      await this.fetchPromise;
      return;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    
    if (timeSinceLastFetch < this.MIN_FETCH_INTERVAL_MS) {
      await new Promise((resolve) => 
        setTimeout(resolve, this.MIN_FETCH_INTERVAL_MS - timeSinceLastFetch)
      );
    }

    this.fetchPromise = this.doFetch(useScanner);
    
    try {
      await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async doFetch(useScanner: boolean): Promise<void> {
    const tokens = Array.from(this.pendingTokens);
    this.pendingTokens.clear();

    if (tokens.length === 0) return;

    const config = useScanner ? this.scannerConfig : (this.userConfig || this.scannerConfig);
    if (!config) {
      console.error("[QuoteCache] No config available");
      return;
    }

    try {
      const instrumentInfoMap = await this.getInstrumentInfo(tokens);

      const batches: number[][] = [];
      for (let i = 0; i < tokens.length; i += 500) {
        batches.push(tokens.slice(i, i + 500));
      }

      for (const batch of batches) {
        const instrumentParams = batch.map((t) => {
          const info = instrumentInfoMap.get(t);
          if (info) {
            return `${info.exchange}:${info.tradingsymbol}`;
          }
          if (t === 256265) return "NSE:NIFTY 50";
          if (t === 260105) return "NSE:NIFTY BANK";
          if (t === 257801) return "NSE:NIFTY FIN SERVICE";
          return `NSE:${t}`;
        });

        const response = await fetch(
          `https://api.kite.trade/quote?${instrumentParams.map((i) => `i=${encodeURIComponent(i)}`).join("&")}`,
          {
            headers: {
              "X-Kite-Version": "3",
              Authorization: `token ${config.apiKey}:${config.accessToken}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          console.error("[QuoteCache] Fetch failed:", response.status);
          continue;
        }

        const data = await response.json();
        const rawQuotes = data.data || {};
        const fetchedAt = Date.now();

        for (const [, quote] of Object.entries(rawQuotes)) {
          const q = quote as {
            instrument_token: number;
            last_price: number;
            volume: number;
            oi: number;
            last_trade_time: string;
            ohlc: { open: number; high: number; low: number; close: number };
            depth?: {
              buy: Array<{ price: number }>;
              sell: Array<{ price: number }>;
            };
          };

          const prevClose = q.ohlc?.close || 0;
          const change = q.last_price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

          const quoteData: QuoteData = {
            instrument_token: q.instrument_token,
            last_price: q.last_price,
            change,
            change_percent: changePercent,
            volume: q.volume || 0,
            oi: q.oi || 0,
            open: q.ohlc?.open || 0,
            high: q.ohlc?.high || 0,
            low: q.ohlc?.low || 0,
            close: q.ohlc?.close || 0,
            bid: q.depth?.buy?.[0]?.price || 0,
            ask: q.depth?.sell?.[0]?.price || 0,
            timestamp: q.last_trade_time || new Date().toISOString(),
          };

          this.cache.set(q.instrument_token, { data: quoteData, fetchedAt });
        }
      }

      this.lastFetchTime = Date.now();
    } catch (error) {
      console.error("[QuoteCache] Error fetching quotes:", error);
    }
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingTokens: this.pendingTokens.size,
      hasFetchInProgress: !!this.fetchPromise,
    };
  }

  clear() {
    this.cache.clear();
    this.pendingTokens.clear();
  }
}

export const quoteCache = new QuoteCache();
