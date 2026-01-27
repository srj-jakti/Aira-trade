import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SEBI_DISCLAIMER = "This output is generated for analytical purposes only and does not constitute investment advice. All decisions are made by the user.";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    let query = supabase
      .from("ai_signals")
      .select(`
        *,
        strategies:strategy_id (name)
      `)
      .eq("user_id", user.id);

    if (type) {
      query = query.eq("signal_type", type.toUpperCase());
    }

    const { data: outputs, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    const formattedOutputs = outputs.map((s: any) => ({
      ...s,
      strategy_name: s.strategies?.name || "AI Dynamic",
      direction: s.direction === 'BUY' ? 'LONG' : s.direction === 'SELL' ? 'SHORT' : s.direction
    }));

    return NextResponse.json({ 
      success: true, 
      outputs: formattedOutputs,
      disclaimer: SEBI_DISCLAIMER
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
