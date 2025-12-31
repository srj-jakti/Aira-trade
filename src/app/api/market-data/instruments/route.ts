import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface Instrument {
  instrument_token: number;
  tradingsymbol: string;
  name: string | null;
  exchange: string;
  segment: string | null;
  instrument_type: string | null;
  lot_size: number;
  tick_size: number;
  is_subscribed: boolean;
  expiry: string | null;
  strike: number | null;
}

function getInstrumentPriority(instrument: Instrument, searchLower: string): number {
  const symbol = instrument.tradingsymbol.toLowerCase();
  const segment = instrument.segment?.toLowerCase() || "";
  const exchange = instrument.exchange;
  const instrumentType = instrument.instrument_type;
  
  const isExactMatch = symbol === searchLower;
  const startsWithSearch = symbol.startsWith(searchLower);
  
  const hasStrikeInSearch = /\d{4,}/.test(searchLower);
  const hasOptionIndicator = searchLower.includes("ce") || searchLower.includes("pe");
  const isCurrencySearch = /usd|eur|gbp|jpy|inr|currency/i.test(searchLower);
  const isCommoditySearch = /gold|silver|crude|natural|copper|zinc|alumin|mcx/i.test(searchLower);
  
  let priority = 1000;

  if (hasStrikeInSearch || hasOptionIndicator) {
    if (segment.includes("nfo-opt")) {
      priority = isExactMatch ? 1 : startsWithSearch ? 5 : 20;
      if (instrumentType === "CE" && searchLower.includes("ce")) priority -= 2;
      if (instrumentType === "PE" && searchLower.includes("pe")) priority -= 2;
    } else if (segment.includes("bfo-opt")) {
      priority = isExactMatch ? 10 : startsWithSearch ? 15 : 30;
    } else if (segment.includes("nfo-fut")) {
      priority = startsWithSearch ? 25 : 40;
    }
    return priority;
  }

  if (isCurrencySearch) {
    if (segment.includes("cds")) {
      priority = isExactMatch ? 1 : startsWithSearch ? 5 : 15;
    } else if (exchange === "NSE" || exchange === "BSE") {
      priority = 100;
    }
    return priority;
  }

  if (isCommoditySearch) {
    if (exchange === "MCX") {
      priority = isExactMatch ? 1 : startsWithSearch ? 5 : 15;
    }
    return priority;
  }

  if (segment === "indices") {
    if (exchange === "NSE" || exchange === "NSEIX") {
      priority = isExactMatch ? 1 : startsWithSearch ? 3 : 10;
    } else if (exchange === "BSE") {
      priority = isExactMatch ? 5 : startsWithSearch ? 8 : 15;
    } else if (exchange === "MCX") {
      priority = isExactMatch ? 12 : startsWithSearch ? 15 : 25;
    } else {
      priority = 30;
    }
    return priority;
  }

  if (exchange === "NSE" && segment === "NSE" && instrumentType === "EQ") {
    priority = isExactMatch ? 20 : startsWithSearch ? 25 : 40;
    return priority;
  }

  if (exchange === "BSE" && segment === "BSE" && instrumentType === "EQ") {
    priority = isExactMatch ? 50 : startsWithSearch ? 55 : 70;
    return priority;
  }

  if (segment?.includes("nfo-fut")) {
    priority = isExactMatch ? 80 : startsWithSearch ? 85 : 100;
    return priority;
  }

  if (segment?.includes("nfo-opt")) {
    priority = isExactMatch ? 110 : startsWithSearch ? 115 : 130;
    return priority;
  }

  if (exchange === "MCX") {
    priority = isExactMatch ? 140 : startsWithSearch ? 145 : 160;
    return priority;
  }

  if (segment?.includes("cds")) {
    priority = isExactMatch ? 170 : startsWithSearch ? 175 : 190;
    return priority;
  }

  return priority;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const exchange = searchParams.get("exchange");
  const segment = searchParams.get("segment");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    let query = supabaseAdmin
      .from("instruments")
      .select("instrument_token, tradingsymbol, name, exchange, segment, instrument_type, lot_size, tick_size, is_subscribed, expiry, strike")
      .limit(200);

    if (search) {
      const searchLower = search.toLowerCase();
      const hasStrike = /\d{4,}/.test(search);
      
      if (hasStrike) {
        const baseSymbol = search.replace(/\d+/g, "").replace(/CE|PE/gi, "").trim();
        const strikeMatch = search.match(/\d+/);
        const strike = strikeMatch ? strikeMatch[0] : "";
        const optionType = search.match(/CE|PE/i)?.[0]?.toUpperCase();
        
        if (baseSymbol && strike) {
          query = query.ilike("tradingsymbol", `%${baseSymbol}%${strike}%`);
          if (optionType) {
            query = query.ilike("tradingsymbol", `%${optionType}`);
          }
        } else {
          query = query.or(`tradingsymbol.ilike.%${search}%,name.ilike.%${search}%`);
        }
      } else {
        query = query.or(`tradingsymbol.ilike.%${search}%,name.ilike.%${search}%`);
      }
    }

    if (exchange) {
      query = query.eq("exchange", exchange);
    }

    if (segment) {
      query = query.eq("segment", segment);
    }

    const { data: instruments, error } = await query;

    if (error) {
      console.error("Error fetching instruments:", error);
      return serverErrorResponse();
    }

    const searchLower = search.toLowerCase();
    const sortedInstruments = (instruments || [])
      .map((inst) => ({
        ...inst,
        priority: getInstrumentPriority(inst as Instrument, searchLower),
      }))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, limit)
      .map(({ priority, ...rest }) => rest);

    return successResponse({ instruments: sortedInstruments });
  } catch (error) {
    console.error("Error searching instruments:", error);
    return serverErrorResponse();
  }
}
