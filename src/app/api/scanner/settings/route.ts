import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("trading_preferences")
      .select("scanner_config, preferred_markets, daily_profit_limit, daily_loss_limit")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const settings = data || {};
    const scanner_config = settings.scanner_config || {};

    // Use general settings as defaults if scanner-specific settings are missing
    const responseConfig = {
      selectedStrategies: scanner_config.selectedStrategies || [],
      dailyProfitTarget: scanner_config.dailyProfitTarget || settings.daily_profit_limit || 5000,
      dailyLossLimit: scanner_config.dailyLossLimit || settings.daily_loss_limit || 2000,
      segments: scanner_config.segments || settings.preferred_markets || ["NSE", "NFO"],
      orderType: scanner_config.orderType || "MIS",
      slicingEnabled: scanner_config.slicingEnabled ?? true,
      maxSlicingQuantity: scanner_config.maxSlicingQuantity || 100
    };

    return NextResponse.json({ success: true, config: responseConfig });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await req.json();

    const { error } = await supabase
      .from("trading_preferences")
      .upsert({
        user_id: user.id,
        scanner_config: config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
