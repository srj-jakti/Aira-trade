import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { userZerodhaService } from "@/lib/server/user-zerodha-service";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (enabled) {
      const result = await userZerodhaService.enableAutoLogin(user.id);
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true, 
        message: "Auto-login enabled. Your Zerodha session will be automatically refreshed." 
      });
    } else {
      await userZerodhaService.disableAutoLogin(user.id);
      
      return NextResponse.json({ 
        success: true, 
        message: "Auto-login disabled." 
      });
    }
  } catch (error) {
    console.error("[Auto-login API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update auto-login setting" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current auto-login status
    const { data: account } = await supabase
      .from("user_broker_accounts")
      .select("auto_login_enabled, is_connected, token_expires_at")
      .eq("user_id", user.id)
      .eq("broker", "zerodha")
      .single();

    if (!account) {
      return NextResponse.json({ error: "No broker account found" }, { status: 404 });
    }

    return NextResponse.json({
      auto_login_enabled: account.auto_login_enabled || false,
      is_connected: account.is_connected,
      token_expires_at: account.token_expires_at,
    });
  } catch (error) {
    console.error("[Auto-login API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get auto-login status" },
      { status: 500 }
    );
  }
}
