import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import Redis from "ioredis";

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

  // Create a dedicated Redis subscriber for this connection
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const subscriber = new Redis(redisUrl);

  // Send initial connection message
  writer.write(encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`));

  // Subscribe to Redis channels for each instrument
  const channels = instrumentTokens.length > 0 
    ? instrumentTokens.flatMap(token => [`ticker:${token}`, `candles:1minute:${token}`])
    : []; 

  if (channels.length > 0) {
    await subscriber.subscribe(...channels);
  }

  subscriber.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message);
      const type = channel.startsWith("ticker:") ? "tick" : "candle";
      writer.write(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
    } catch (e) {
      console.error("[SSE] Error processing Redis message:", e);
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

  request.signal.onabort = async () => {
    console.log(`[SSE] User ${user.session?.user.id} disconnected`);
    clearInterval(heartbeatInterval);
    try {
      await subscriber.quit();
    } catch (e) {
      console.error("[SSE] Error closing Redis subscriber:", e);
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
