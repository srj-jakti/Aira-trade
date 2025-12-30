import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient();
  const { userId } = await params;
  
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

  await supabase.from("profiles").delete().eq("id", userId);
  await supabase.from("subscriptions").delete().eq("user_id", userId);
  await supabase.from("user_config").delete().eq("user_id", userId);
  await supabase.from("trading_preferences").delete().eq("user_id", userId);
  await supabase.from("strategies").delete().eq("user_id", userId);

  return NextResponse.json({ success: true });
}
