import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Check if a user is an admin
 * Admins have access to all features regardless of subscription
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    // Check if user has admin subscription
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id, is_admin_grant")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (subscription?.plan_id === "admin" || subscription?.is_admin_grant) {
      return true;
    }

    // Check if user has admin role in profiles (if that table exists)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();

    return profile?.is_admin === true;
  } catch (error) {
    console.error("[Admin Check] Error checking admin status:", error);
    return false;
  }
}

/**
 * Get user's effective plan, considering admin status
 */
export async function getUserPlan(userId: string): Promise<string> {
  // Check if admin first
  const isAdmin = await isUserAdmin(userId);
  if (isAdmin) {
    return "admin";
  }

  // Get regular subscription
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return subscription?.plan_id || "basic";
}
