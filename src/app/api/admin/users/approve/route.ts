import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const { userId, approve } = body;

  const { error } = await supabase
    .from("profiles")
    .update({ 
      is_approved: approve,
      approved_at: approve ? new Date().toISOString() : null,
      approved_by: approve ? adminUser.id : null
    })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
