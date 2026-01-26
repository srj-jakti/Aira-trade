import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  successResponse,
} from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) return unauthorizedResponse();

  try {
    const { data: strategies } = await supabaseAdmin
      .from("strategies")
      .select(`
        id, name, description, visibility, is_active,
        selected_timeframes, created_at, user_id, admin_approved
      `)
      .eq("admin_approved", true)
      .in("visibility", ["public", "invite_only"])
      .order("created_at", { ascending: false });

    const publicStrategies = await Promise.all(
      (strategies || []).map(async (s) => {
        const { data: backtests } = await supabaseAdmin
          .from("strategy_backtests")
          .select("win_rate, net_pnl_percentage, total_trades")
          .eq("strategy_id", s.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const stats = backtests?.[0] || null;

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("username")
          .eq("id", s.user_id)
          .single();

        return {
          ...s,
          creator: profile?.username || "Anonymous",
          stats,
        };
      })
    );

    return successResponse({ strategies: publicStrategies });
  } catch (error) {
    console.error("Error fetching public strategies:", error);
    return serverErrorResponse();
  }
}
