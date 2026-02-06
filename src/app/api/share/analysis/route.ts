import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, serverErrorResponse } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";

const shareSchema = z.object({
  instrumentToken: z.number(),
  tradingsymbol: z.string(),
  timeframe: z.string(),
  analysisData: z.record(z.string(), z.unknown()),
  chartConfig: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated || !user.userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const validation = shareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { instrumentToken, tradingsymbol, timeframe, analysisData, chartConfig } = validation.data;

    // Create shared analysis snapshot
    const { data, error } = await supabaseAdmin
      .from("shared_analysis")
      .insert({
        user_id: user.userId,
        instrument_token: instrumentToken,
        tradingsymbol,
        timeframe,
        analysis_data: analysisData,
        chart_config: chartConfig || {},
        // Expires in 7 days by default (optional policy)
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Share creation error:", error);
      return serverErrorResponse();
    }

    // Generate public URL
    // Assuming the app is hosted at the request origin or configured URL
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://aira.trade";
    const shareUrl = `${origin}/share/${data.id}`;

    return NextResponse.json({
      success: true,
      shareId: data.id,
      shareUrl,
    });

  } catch (error) {
    console.error("API Error:", error);
    return serverErrorResponse();
  }
}
