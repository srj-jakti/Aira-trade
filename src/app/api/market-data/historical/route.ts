import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getHistoricalCandles } from "@/lib/server/market-data-engine";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const instrumentToken = searchParams.get("instrument");
  const timeframe = searchParams.get("timeframe") || "1d";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!instrumentToken) {
    return badRequestResponse("instrument parameter is required");
  }

  try {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const candles = await getHistoricalCandles(
      parseInt(instrumentToken),
      timeframe,
      fromDate,
      toDate
    );

    return successResponse({ candles });
  } catch (error) {
    console.error("Error fetching historical data:", error);
    return serverErrorResponse();
  }
}
