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
import { fetchAndStoreInstruments } from "@/lib/server/market-data-engine";

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const exchange = searchParams.get("exchange");
  const subscribedOnly = searchParams.get("subscribed") === "true";
  const limit = parseInt(searchParams.get("limit") || "500");

  try {
    let query = supabaseAdmin
      .from("instruments")
      .select("*")
      .limit(limit);

    if (search) {
      query = query.or(`tradingsymbol.ilike.%${search}%,name.ilike.%${search}%`);
    }

    if (exchange) {
      query = query.eq("exchange", exchange);
    }

    if (subscribedOnly) {
      query = query.eq("is_subscribed", true);
    }

    const { data: instruments, error } = await query;

    if (error) {
      return serverErrorResponse();
    }

    const { count: totalCount } = await supabaseAdmin
      .from("instruments")
      .select("*", { count: "exact", head: true });

    const { count: subscribedCount } = await supabaseAdmin
      .from("instruments")
      .select("*", { count: "exact", head: true })
      .eq("is_subscribed", true);

    return successResponse({
      instruments: instruments || [],
      stats: {
        total: totalCount || 0,
        subscribed: subscribedCount || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching instruments:", error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse("Admin access required");

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "refresh") {
      const count = await fetchAndStoreInstruments();
      return successResponse({ success: true, count, message: `Refreshed ${count} instruments` });
    }

    if (action === "subscribe") {
      const { instrumentTokens, mode = "full" } = body;
      if (!instrumentTokens || !Array.isArray(instrumentTokens)) {
        return badRequestResponse("instrumentTokens array is required");
      }

      await supabaseAdmin
        .from("instruments")
        .update({ is_subscribed: true, subscription_mode: mode, updated_at: new Date().toISOString() })
        .in("instrument_token", instrumentTokens);

      return successResponse({ success: true, count: instrumentTokens.length });
    }

    if (action === "unsubscribe") {
      const { instrumentTokens } = body;
      if (!instrumentTokens || !Array.isArray(instrumentTokens)) {
        return badRequestResponse("instrumentTokens array is required");
      }

      await supabaseAdmin
        .from("instruments")
        .update({ is_subscribed: false, updated_at: new Date().toISOString() })
        .in("instrument_token", instrumentTokens);

      return successResponse({ success: true, count: instrumentTokens.length });
    }

    return badRequestResponse("Invalid action");
  } catch (error) {
    console.error("Error managing instruments:", error);
    return serverErrorResponse();
  }
}
