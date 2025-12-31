import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchAndStoreInstruments } from "@/lib/server/market-data-engine";

export async function POST() {
  try {
    const count = await fetchAndStoreInstruments();
    
    // Update sync time
    await supabaseAdmin.from("data_engine_status").upsert({
      engine_type: "market_data",
      last_instrument_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "engine_type" });

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error("Error syncing instruments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
