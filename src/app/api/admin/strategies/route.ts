import {
  getAdminUser,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin.authenticated) return unauthorizedResponse();
  if (!admin.isAdmin) return forbiddenResponse();

  try {
    const { data: strategies } = await supabaseAdmin
      .from("strategies")
      .select(`
        id, name, description, visibility, admin_approved,
        selected_timeframes, created_at, user_id, status
      `)
      .in("visibility", ["public", "invite_only"])
      .order("created_at", { ascending: false });

    const strategiesWithCreators = await Promise.all(
      (strategies || []).map(async (s) => {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("username, email")
          .eq("id", s.user_id)
          .single();

        const { data: backtests } = await supabaseAdmin
          .from("strategy_backtests")
          .select("win_rate, net_pnl_percentage, total_trades")
          .eq("strategy_id", s.id)
          .order("created_at", { ascending: false })
          .limit(1);

        return {
          ...s,
          creator: profile || { username: "Unknown", email: "" },
          stats: backtests?.[0] || null,
        };
      })
    );

    return successResponse({ strategies: strategiesWithCreators });
  } catch (error) {
    console.error("Error fetching strategies for admin:", error);
    return serverErrorResponse();
  }
}
