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

type InstrumentCategory = "INDEX" | "EQUITY" | "FUTURE" | "OPTION" | "CURRENCY" | "COMMODITY" | "OTHER";

const INDEX_NAMES = ["NIFTY 50", "NIFTY BANK", "BANKNIFTY", "FINNIFTY", "SENSEX", "NIFTY", "MIDCPNIFTY"];

function classifyInstrument(instrument: Instrument): InstrumentCategory {
  const segment = instrument.segment?.toLowerCase() || "";
  const exchange = instrument.exchange;
  const type = instrument.instrument_type;

  if (segment === "indices" || INDEX_NAMES.includes(instrument.tradingsymbol)) return "INDEX";
  if (segment.includes("nfo-opt") || segment.includes("bfo-opt") || type === "CE" || type === "PE") return "OPTION";
  if (segment.includes("nfo-fut") || segment.includes("bfo-fut") || segment.includes("mcx-fut")) return "FUTURE";
  if (segment.includes("cds")) return "CURRENCY";
  if (exchange === "MCX") return "COMMODITY";
  if ((exchange === "NSE" || exchange === "BSE") && (segment === "nse" || segment === "bse") && type === "EQ") return "EQUITY";
  
  return "OTHER";
}

function getInstrumentPriority(instrument: Instrument, searchLower: string): number {
  const symbol = instrument.tradingsymbol.toLowerCase();
  const name = instrument.name?.toLowerCase() || "";
  const category = classifyInstrument(instrument);
  
  const isExactMatch = symbol === searchLower || name === searchLower;
  const startsWithSearch = symbol.startsWith(searchLower) || name.startsWith(searchLower);
  const containsSearch = symbol.includes(searchLower) || name.includes(searchLower);
  
  const hasStrikeInSearch = /\d{4,}/.test(searchLower);
  const hasOptionIndicator = /\s*(ce|pe)$/i.test(searchLower) || searchLower.includes(" ce") || searchLower.includes(" pe");
  const isCurrencySearch = /usd|eur|gbp|jpy|inr|currency/i.test(searchLower);
  const isCommoditySearch = /gold|silver|crude|natural|copper|zinc|alumin|mcx/i.test(searchLower);
  
  let priority = 1000;
  
  if (hasStrikeInSearch || hasOptionIndicator) {
    if (category === "OPTION") {
      priority = isExactMatch ? 1 : startsWithSearch ? 5 : containsSearch ? 15 : 30;
      if (instrument.instrument_type === "CE" && searchLower.includes("ce")) priority -= 2;
      if (instrument.instrument_type === "PE" && searchLower.includes("pe")) priority -= 2;
    } else if (category === "FUTURE") {
      priority = startsWithSearch ? 40 : 50;
    } else if (category === "EQUITY" || category === "INDEX") {
      priority = isExactMatch ? 60 : 70;
    }
    return priority;
  }

  if (isCurrencySearch) {
    if (category === "CURRENCY") {
      priority = isExactMatch ? 1 : startsWithSearch ? 5 : 15;
    }
    return priority;
  }

  if (isCommoditySearch) {
    if (category === "COMMODITY") {
      priority = isExactMatch ? 1 : startsWithSearch ? 5 : 15;
    }
    return priority;
  }

  switch (category) {
    case "INDEX":
      priority = isExactMatch ? 1 : startsWithSearch ? 5 : containsSearch ? 15 : 100;
      break;
    case "EQUITY":
      if (instrument.exchange === "NSE") {
        priority = isExactMatch ? 10 : startsWithSearch ? 20 : containsSearch ? 30 : 110;
      } else {
        priority = isExactMatch ? 40 : startsWithSearch ? 50 : containsSearch ? 60 : 120;
      }
      break;
    case "FUTURE":
      priority = isExactMatch ? 70 : startsWithSearch ? 80 : containsSearch ? 90 : 130;
      break;
    case "OPTION":
      priority = isExactMatch ? 200 : startsWithSearch ? 250 : containsSearch ? 300 : 400;
      break;
    case "CURRENCY":
      priority = isExactMatch ? 140 : startsWithSearch ? 150 : containsSearch ? 160 : 180;
      break;
    case "COMMODITY":
      priority = isExactMatch ? 160 : startsWithSearch ? 170 : containsSearch ? 175 : 190;
      break;
    default:
      priority = 500;
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
      .limit(500);

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
    
    const deduplicatedInstruments = deduplicateWithNSEPreference(instruments || []);
    
    const sortedInstruments = deduplicatedInstruments
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

function deduplicateWithNSEPreference(instruments: Instrument[]): Instrument[] {
  const symbolMap = new Map<string, Instrument>();
  
  for (const inst of instruments) {
    const category = classifyInstrument(inst);
    
    if (category !== "EQUITY") {
      const key = `${inst.tradingsymbol}_${inst.exchange}_${inst.segment}`;
      if (!symbolMap.has(key)) {
        symbolMap.set(key, inst);
      }
      continue;
    }
    
    const key = inst.tradingsymbol;
    const existing = symbolMap.get(key);
    
    if (!existing) {
      symbolMap.set(key, inst);
    } else if (inst.exchange === "NSE" && existing.exchange !== "NSE") {
      symbolMap.set(key, inst);
    }
  }
  
  return Array.from(symbolMap.values());
}
