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
  if (!admin.authenticated) {
    return unauthorizedResponse();
  }
  if (!admin.isAdmin) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      return serverErrorResponse();
    }

    const authUsers = authData?.users || [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, is_approved, approved_at, approved_by");

    const { data: subscriptions } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan_name");

    const users = authUsers.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id);
      const subscription = subscriptions?.find((s) => s.user_id === authUser.id);
      
      return {
        id: authUser.id,
        email: authUser.email || "",
        full_name: profile?.full_name || authUser.user_metadata?.full_name || null,
        is_approved: profile?.is_approved ?? false,
        is_blocked: authUser.banned_until ? true : false,
        banned_until: authUser.banned_until || null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null,
        plan: subscription?.plan_name || null,
        email_confirmed: !!authUser.email_confirmed_at,
      };
    });

    users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return successResponse({ users });
  } catch (err) {
    console.error("Error in admin users API:", err);
    return serverErrorResponse();
  }
}
