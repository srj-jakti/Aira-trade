import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  successResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { zerodhaService } from "@/lib/server/zerodha-service";

export const dynamic = "force-dynamic";

interface QuoteData {
  instrument_token: number;
  timestamp: string;
  last_trade_time: string;
  last_price: number;
  last_quantity: number;
  buy_quantity: number;
  sell_quantity: number;
  volume: number;
  average_price: number;
  oi: number;
  oi_day_high: number;
  oi_day_low: number;
  net_change: number;
  lower_circuit_limit: number;
  upper_circuit_limit: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  change: number;
  depth?: {
    buy: Array<{ price: number; quantity: number; orders: number }>;
    sell: Array<{ price: number; quantity: number; orders: number }>;
  };
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentsParam = searchParams.get("instruments");

  if (!instrumentsParam) {
    return badRequestResponse("instruments parameter required (comma-separated tokens)");
  }

  const tokens = instrumentsParam.split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return badRequestResponse("At least one instrument token required");
  }

  if (tokens.length > 500) {
    return badRequestResponse("Maximum 500 instruments per request");
  }

  try {
    const config = await zerodhaService.getActiveConfig();
    if (!config) {
      return successResponse({
        success: false,
        error: "No active Zerodha connection",
        quotes: {},
      });
    }

    const instrumentParams = tokens.map((t) => {
      const numToken = parseInt(t);
      if (numToken === 256265) return "NSE:NIFTY 50";
      if (numToken === 260105) return "NSE:NIFTY BANK";
      if (numToken === 257801) return "NSE:NIFTY FIN SERVICE";
      return `NFO:${t}`;
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
      const error = await response.json().catch(() => ({ message: response.statusText }));
      
      if (response.status === 403) {
        return successResponse({
          success: false,
          error: "Token expired - needs re-login",
          quotes: {},
        });
      }
      
      return successResponse({
        success: false,
        error: error.message || "Failed to fetch quotes",
        quotes: {},
      });
    }

    const data = await response.json();
    const rawQuotes = data.data || {};

    const quotes: Record<string, {
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
    }> = {};

    for (const [key, quote] of Object.entries(rawQuotes)) {
      const q = quote as QuoteData;
      const token = q.instrument_token;
      const prevClose = q.ohlc?.close || 0;
      const change = q.last_price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      quotes[String(token)] = {
        instrument_token: token,
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
    }

    return successResponse({
      success: true,
      quotes,
      count: Object.keys(quotes).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[OnDemand] Error:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
