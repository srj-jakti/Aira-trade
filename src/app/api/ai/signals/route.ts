import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch signals with strategy names
    const { data: signals, error } = await supabase
      .from("ai_signals")
      .select(`
        *,
        strategies:strategy_id (name)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Flatten strategy name
    const formattedSignals = signals.map((s: any) => ({
      ...s,
      strategy_name: s.strategies?.name || "AI Dynamic"
    }));

    return NextResponse.json({ success: true, signals: formattedSignals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
