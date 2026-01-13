import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const instrumentTokens = searchParams.get("instruments")?.split(",").map(Number) || [];

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection message
  writer.write(encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`));

  // Subscribe to live_candles changes
  const channel = supabaseAdmin
    .channel(`realtime_market_data_${user.session?.user.id}_${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "live_candles",
      },
      (payload) => {
        const newCandle = payload.new as any;
        
        // Filter by requested instruments if any
        if (instrumentTokens.length > 0 && !instrumentTokens.includes(newCandle.instrument_token)) {
          return;
        }

        try {
          writer.write(encoder.encode(`data: ${JSON.stringify({ type: "candle", data: newCandle })}\n\n`));
        } catch (e) {
          // Writer might be closed
        }
      }
    )
    .subscribe((status) => {
       if (status === 'SUBSCRIBED') {
          console.log(`[SSE] User ${user.session?.user.id} subscribed to realtime market data`);
       }
    });

  // Keep connection alive with a heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    try {
      writer.write(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`));
    } catch (e) {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  request.signal.onabort = () => {
    console.log(`[SSE] User ${user.session?.user.id} disconnected`);
    clearInterval(heartbeatInterval);
    channel.unsubscribe();
    writer.close();
  };

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Important for Nginx/Vercel
    },
  });
}
