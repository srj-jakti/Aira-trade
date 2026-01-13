import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { redisSub } from "@/lib/redis";

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

  // Subscribe to Redis channels for each instrument
  const channels = instrumentTokens.length > 0 
    ? instrumentTokens.flatMap(token => [`ticker:${token}`, `candles:1minute:${token}`])
    : ["ticker:*", "candles:1minute:*"]; // Pattern matching if supported, but better to be explicit

  if (instrumentTokens.length > 0) {
    await redisSub.subscribe(...channels);
  } else {
    // If no instruments specified, maybe subscribe to a global channel or just wait
    // For now, let's assume instruments are always provided for efficiency
  }

  const messageHandler = (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      const type = channel.startsWith("ticker:") ? "tick" : "candle";
      writer.write(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
    } catch (e) {
      console.error("[SSE] Error processing Redis message:", e);
    }
  };

  redisSub.on("message", messageHandler);

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
    redisSub.off("message", messageHandler);
    if (instrumentTokens.length > 0) {
      redisSub.unsubscribe(...channels);
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
