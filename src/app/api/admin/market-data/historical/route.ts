import { NextRequest } from "next/server";
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchHistoricalData, storeHistoricalCandles } from "@/lib/server/market-data-engine";

const TIMEFRAMES = ["1m", "3m", "5m", "10m", "15m", "30m", "1h", "1d"];

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

    try {
      const { data: downloads } = await supabaseAdmin
        .from("historical_data_downloads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // Get coverage using a more efficient way than fetching 10k rows
      const { data: coverageData, error: coverageError } = await supabaseAdmin.rpc("get_historical_coverage");

      let coverage = coverageData;
      
      // Fallback if RPC doesn't exist (though we should create it)
      if (coverageError || !coverage) {
        const { data: fallbackCoverage } = await supabaseAdmin
          .from("historical_candles")
          .select("instrument_token, timeframe")
          .limit(50000); // Increased limit as a stop-gap
        coverage = fallbackCoverage;
      }

      const coverageMap: Record<string, Set<string>> = {};
      const instrumentTokens = new Set<string>();
      (coverage || []).forEach((c: any) => {
        const tokenStr = String(c.instrument_token);
        if (!coverageMap[tokenStr]) {
          coverageMap[tokenStr] = new Set();
          instrumentTokens.add(tokenStr);
        }
        coverageMap[tokenStr].add(c.timeframe);
      });

    // Fetch instrument details for covered tokens
    let instrumentsInfo = [];
    if (instrumentTokens.size > 0) {
      const { data: instruments } = await supabaseAdmin
        .from("instruments")
        .select("instrument_token, tradingsymbol, name, exchange")
        .in("instrument_token", Array.from(instrumentTokens));
      instrumentsInfo = instruments || [];
    }

    const { count: totalCandles } = await supabaseAdmin
      .from("historical_candles")
      .select("*", { count: "exact", head: true });

    return successResponse({
      downloads: downloads || [],
      coverage: Object.fromEntries(
        Object.entries(coverageMap).map(([k, v]) => [k, Array.from(v)])
      ),
      instruments: instrumentsInfo,
      stats: {
        totalCandles: totalCandles || 0,
        timeframes: TIMEFRAMES,
      },
    });
  } catch (error) {
    console.error("Error fetching historical data status:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const body = await request.json();
    const { instrumentToken, timeframe, startDate, endDate } = body;

    if (!instrumentToken || !timeframe || !startDate || !endDate) {
      return badRequestResponse("instrumentToken, timeframe, startDate, and endDate are required");
    }

    if (!TIMEFRAMES.includes(timeframe)) {
      return badRequestResponse(`Invalid timeframe. Valid: ${TIMEFRAMES.join(", ")}`);
    }

    const { data: download } = await supabaseAdmin
      .from("historical_data_downloads")
      .insert({
        instrument_token: instrumentToken,
        timeframe,
        start_date: startDate,
        end_date: endDate,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    try {
      const candles = await fetchHistoricalData(
        instrumentToken,
        timeframe,
        new Date(startDate),
        new Date(endDate)
      );

      const stored = await storeHistoricalCandles(instrumentToken, timeframe, candles);

      await supabaseAdmin
        .from("historical_data_downloads")
        .update({
          status: "completed",
          total_candles: candles.length,
          downloaded_candles: stored,
          completed_at: new Date().toISOString(),
        })
        .eq("id", download?.id);

      return successResponse({
        success: true,
        downloadId: download?.id,
        totalCandles: candles.length,
        storedCandles: stored,
      });
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : "Unknown error";
      
      await supabaseAdmin
        .from("historical_data_downloads")
        .update({
          status: "failed",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", download?.id);

      return successResponse({
        success: false,
        error: errorMsg,
        downloadId: download?.id,
      });
    }
  } catch (error) {
    console.error("Error downloading historical data:", error);
    return serverErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const body = await request.json();
    const { instrumentToken, timeframe, olderThan } = body;

    let query = supabaseAdmin.from("historical_candles").delete();

    if (instrumentToken) {
      query = query.eq("instrument_token", instrumentToken);
    }

    if (timeframe) {
      query = query.eq("timeframe", timeframe);
    }

    if (olderThan) {
      query = query.lt("timestamp", olderThan);
    }

    const { error, count } = await query.select("id");

    if (error) {
      return serverErrorResponse();
    }

    return successResponse({
      success: true,
      deletedCount: count || 0,
    });
  } catch (error) {
    console.error("Error deleting historical data:", error);
    return serverErrorResponse();
  }
}
