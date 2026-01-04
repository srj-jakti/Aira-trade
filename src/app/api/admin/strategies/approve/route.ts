import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { strategyId, approved, reason } = await req.json();

    if (!strategyId) {
      return NextResponse.json({ error: "Strategy ID is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("strategies")
      .update({
        admin_approved: approved,
        admin_approved_at: new Date().toISOString(),
        status: approved ? "approved" : "rejected",
        metadata: { rejection_reason: reason }
      })
      .eq("id", strategyId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
