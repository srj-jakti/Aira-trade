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
  const { type } = body;

  if (type === "zerodha") {
    const { data: apiKey } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "zerodha_api_key")
      .single();

    if (!apiKey?.value) {
      return NextResponse.json({ error: "API key not configured" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Zerodha config found (connection test pending)" });
  } else if (type === "ai") {
    const { data: apiKey } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ai_api_key")
      .single();

    if (!apiKey?.value) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "AI API key found (connection test pending)" });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
