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
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, is_approved, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return serverErrorResponse();
    }

    const { data: subscriptions } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan_name");

    const users = (profiles || []).map((profile) => {
      const subscription = subscriptions?.find((s) => s.user_id === profile.id);
      return {
        ...profile,
        plan: subscription?.plan_name || null,
      };
    });

    return successResponse({ users });
  } catch {
    return serverErrorResponse();
  }
}
