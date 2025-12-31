import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { enabled } = await req.json();

    const { error } = await supabaseAdmin.from("data_engine_status").upsert({
      engine_type: "market_data",
      auto_sync_instruments: enabled,
      updated_at: new Date().toISOString()
    }, { onConflict: "engine_type" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
