import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { instrumentToken } = await req.json();

    if (!instrumentToken) {
      return NextResponse.json({ error: "Instrument token is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("historical_candles")
      .delete()
      .eq("instrument_token", instrumentToken);

    if (error) throw error;

    // Also disable auto-sync for this instrument
    await supabaseAdmin
      .from("instrument_sync_configs")
      .delete()
      .eq("instrument_token", instrumentToken);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting historical data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
