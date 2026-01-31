import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { createClient } from "@supabase/supabase-js";

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

  writer.write(encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const channel = supabase
    .channel(`realtime-ticks-${user.userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "realtime_ticks",
        filter: instrumentTokens.length > 0 
          ? `instrument_token=in.(${instrumentTokens.join(",")})` 
          : undefined,
      },
      (payload) => {
        try {
          writer.write(encoder.encode(`data: ${JSON.stringify({ type: "tick", data: payload.new })}\n\n`));
        } catch (e) {
          console.error("[SSE] Error sending tick:", e);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "live_candles",
        filter: instrumentTokens.length > 0 
          ? `instrument_token=in.(${instrumentTokens.join(",")})` 
          : undefined,
      },
      (payload) => {
        try {
          writer.write(encoder.encode(`data: ${JSON.stringify({ type: "candle", data: payload.new })}\n\n`));
        } catch (e) {
          console.error("[SSE] Error sending candle:", e);
        }
      }
    )
    .subscribe();

  const heartbeatInterval = setInterval(() => {
    try {
      writer.write(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`));
    } catch (_e) {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  request.signal.onabort = async () => {
    console.log(`[SSE] User ${user.userId} disconnected`);
    clearInterval(heartbeatInterval);
    try {
      await supabase.removeChannel(channel);
    } catch (e) {
      console.error("[SSE] Error removing channel:", e);
    }
    writer.close();
  };

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
