import { NextRequest } from "next/server";
import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse();

  try {
    const { strategyId } = await params;
    const id = parseInt(strategyId);

    const { data: strategy, error } = await supabaseAdmin
      .from("strategies")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !strategy) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    const { data: backtests } = await supabaseAdmin
      .from("strategy_backtests")
      .select("*")
      .eq("strategy_id", id)
      .order("created_at", { ascending: false });

    const { data: creator } = await supabaseAdmin
      .from("profiles")
      .select("username, email")
      .eq("id", strategy.user_id)
      .single();

    return successResponse({
      strategy: {
        ...strategy,
        creator: creator || { username: "Unknown", email: "" },
      },
      backtests: backtests || [],
    });
  } catch (error) {
    console.error("Error fetching strategy details:", error);
    return serverErrorResponse();
  }
}
