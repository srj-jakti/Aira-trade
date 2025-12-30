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
  const { type, config } = body;

  if (type === "zerodha") {
    const configKeys = [
      { key: "zerodha_api_key", value: config.apiKey },
      { key: "zerodha_api_secret", value: config.apiSecret },
      { key: "zerodha_user_id", value: config.userId },
      { key: "zerodha_password", value: config.password },
      { key: "zerodha_totp_secret", value: config.totpSecret }
    ];

    for (const { key, value } of configKeys) {
      if (value) {
        await supabase
          .from("app_config")
          .upsert({ key, value, encrypted: true, updated_at: new Date().toISOString() }, { onConflict: "key" });
      }
    }
  } else if (type === "ai") {
    await supabase
      .from("app_config")
      .upsert({ key: "ai_api_key", value: config.apiKey, encrypted: true, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  return NextResponse.json({ success: true });
}

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

  const { data: configs } = await supabase
    .from("app_config")
    .select("key, encrypted, updated_at");

  return NextResponse.json({ configs: configs || [] });
}
