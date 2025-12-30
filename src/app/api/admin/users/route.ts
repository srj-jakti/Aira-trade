import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", user.email)
    .single();

  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_approved, created_at")
    .order("created_at", { ascending: false });

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("user_id, plan_name");

  const users = (profiles || []).map(profile => {
    const subscription = subscriptions?.find(s => s.user_id === profile.id);
    return {
      ...profile,
      plan: subscription?.plan_name || null
    };
  });

  return NextResponse.json({ users });
}
