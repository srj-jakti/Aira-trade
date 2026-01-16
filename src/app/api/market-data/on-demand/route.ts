import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  successResponse,
  serverErrorResponse,
} from "@/lib/server/auth";
import { quoteCache } from "@/lib/server/quote-cache";
import { zerodhaService } from "@/lib/server/zerodha-service";

export const dynamic = "force-dynamic";

let configsInitialized = false;

async function ensureConfigs() {
  if (configsInitialized) return;

  try {
    const configs = await zerodhaService.getAllActiveConfigs();
    
    if (configs.length >= 2) {
      quoteCache.setConfigs(
        { apiKey: configs[0].apiKey, accessToken: configs[0].accessToken },
        { apiKey: configs[1].apiKey, accessToken: configs[1].accessToken }
      );
    } else if (configs.length === 1) {
      quoteCache.setConfigs(
        { apiKey: configs[0].apiKey, accessToken: configs[0].accessToken },
        null
      );
    }
    
    configsInitialized = true;
    
    setTimeout(() => {
      configsInitialized = false;
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error("[OnDemand] Failed to initialize configs:", error);
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentsParam = searchParams.get("instruments");
  const useScanner = searchParams.get("scanner") === "true";

  if (!instrumentsParam) {
    return badRequestResponse("instruments parameter required (comma-separated tokens)");
  }

  const tokens = instrumentsParam
    .split(",")
    .map((t) => parseInt(t.trim()))
    .filter((t) => !isNaN(t) && t > 0);

  if (tokens.length === 0) {
    return badRequestResponse("At least one valid instrument token required");
  }

  if (tokens.length > 500) {
    return badRequestResponse("Maximum 500 instruments per request");
  }

  try {
    await ensureConfigs();

    const quotesMap = await quoteCache.getQuotes(tokens, useScanner);

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

    for (const [token, data] of quotesMap) {
      quotes[String(token)] = data;
    }

    return successResponse({
      success: true,
      quotes,
      count: Object.keys(quotes).length,
      timestamp: new Date().toISOString(),
      cacheStats: quoteCache.getStats(),
    });
  } catch (error) {
    console.error("[OnDemand] Error:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
