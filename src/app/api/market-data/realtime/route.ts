import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { marketDataEngine } from "@/lib/server/market-data-engine";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentTokens = searchParams.get("instruments")?.split(",").map(Number) || [];

  try {
    if (instrumentTokens.length > 0) {
      const ticks = instrumentTokens
        .map((token) => marketDataEngine.getLastTick(token))
        .filter(Boolean);
      return successResponse({ ticks });
    }

    const { data: latestTicks } = await supabaseAdmin
      .from("realtime_ticks")
      .select("*")
      .order("tick_timestamp", { ascending: false })
      .limit(100);

    const uniqueTicks = new Map();
    (latestTicks || []).forEach((tick) => {
      if (!uniqueTicks.has(tick.instrument_token)) {
        uniqueTicks.set(tick.instrument_token, tick);
      }
    });

    return successResponse({ ticks: Array.from(uniqueTicks.values()) });
  } catch (error) {
    console.error("Error fetching realtime data:", error);
    return serverErrorResponse();
  }
}
