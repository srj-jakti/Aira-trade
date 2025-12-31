import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const exchange = searchParams.get("exchange");
  const segment = searchParams.get("segment");
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    let query = supabaseAdmin
      .from("instruments")
      .select("instrument_token, tradingsymbol, name, exchange, segment, instrument_type, lot_size, tick_size, is_subscribed")
      .limit(limit);

    if (search) {
      query = query.or(`tradingsymbol.ilike.%${search}%,name.ilike.%${search}%`);
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

    return successResponse({ instruments: instruments || [] });
  } catch (error) {
    console.error("Error searching instruments:", error);
    return serverErrorResponse();
  }
}
