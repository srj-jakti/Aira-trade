export type DataTier = "CORE" | "SCANNER" | "TEMP";

export interface MarketDataInstrument {
  instrument_token: number;
  tradingsymbol: string;
  exchange: string;
  segment?: string;
  instrument_type?: string;
  name?: string;
  lot_size?: number;
  expiry?: string;
  strike?: number;
  category?: string;
  last_price?: number;
  volume?: number;
  change_percent?: number;
  tick_timestamp?: string;
}

export interface MarketDataResponse {
  instruments: MarketDataInstrument[];
  count: number;
  tier: DataTier;
  message?: string;
}

export async function fetchFixedInstruments(category?: string): Promise<MarketDataResponse> {
  const url = new URL("/api/market-data/fixed", window.location.origin);
  if (category) url.searchParams.set("category", category);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("Failed to fetch fixed instruments");
  return response.json();
}

export async function fetchOnDemandInstruments(tokens: number[], source?: string): Promise<MarketDataResponse> {
  const response = await fetch("/api/market-data/on-demand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokens, source }),
  });
  if (!response.ok) throw new Error("Failed to fetch on-demand instruments");
  return response.json();
}

export async function fetchSingleInstrument(token: number): Promise<{ instrument: MarketDataInstrument; tier: DataTier }> {
  const url = new URL("/api/market-data/on-demand", window.location.origin);
  url.searchParams.set("token", String(token));

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("Failed to fetch instrument");
  return response.json();
}

export async function subscribeInstruments(tokens: number[], tier: DataTier = "TEMP", source: string = "client"): Promise<void> {
  await fetch("/api/market-data/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokens,
      tier,
      source,
    }),
  });
}

export function getDataTierForPage(page: string): DataTier {
  switch (page) {
    case "scanner":
      return "SCANNER";
    case "strategy":
    case "analysis":
      return "TEMP";
    case "dashboard":
      return "CORE";
    default:
      return "TEMP";
  }
}

export function shouldSubscribeOnPageLoad(page: string): boolean {
  switch (page) {
    case "scanner":
      return false;
    case "strategy":
    case "analysis":
      return true;
    default:
      return false;
  }
}

export function getDataEndpoint(page: string): "fixed" | "on-demand" {
  switch (page) {
    case "scanner":
      return "fixed";
    case "strategy":
    case "analysis":
      return "on-demand";
    default:
      return "on-demand";
  }
}
