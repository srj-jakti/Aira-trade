import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { zerodhaService } from "@/lib/server/zerodha-service";
import { KiteTicker } from "kiteconnect";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface KiteTickData {
  instrument_token: number;
  last_price: number;
  last_quantity?: number;
  average_price?: number;
  volume?: number;
  buy_quantity?: number;
  sell_quantity?: number;
  ohlc?: { open: number; high: number; low: number; close: number };
  change?: number;
  last_trade_time?: Date;
  oi?: number;
  oi_day_high?: number;
  oi_day_low?: number;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user.authenticated) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const instrumentTokens = searchParams.get("instruments")?.split(",").map(Number).filter(Boolean) || [];

  if (instrumentTokens.length === 0) {
    return new Response("No instruments specified", { status: 400 });
  }

  if (instrumentTokens.length > 100) {
    return new Response("Maximum 100 instruments per stream", { status: 400 });
  }

  const config = await zerodhaService.getActiveConfig();
  if (!config) {
    return new Response(JSON.stringify({ 
      error: "No active Zerodha connection",
      message: "Please ensure Zerodha tokens are refreshed via admin login"
    }), { 
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  let ticker: InstanceType<typeof KiteTicker> | null = null;
  let isConnected = false;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const sendEvent = (data: unknown) => {
    try {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
    }
  };

  const cleanup = async () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (ticker) {
      try {
        ticker.disconnect();
      } catch {
      }
      ticker = null;
    }
    try {
      await writer.close();
    } catch {
    }
  };

  try {
    ticker = new KiteTicker({
      api_key: config.apiKey,
      access_token: config.accessToken,
    });

    ticker.autoReconnect(true, 10, 3);

    ticker.on("connect", () => {
      console.log(`[Stream] Connected for user ${user.userId}, subscribing to ${instrumentTokens.length} instruments`);
      isConnected = true;
      
      ticker!.subscribe(instrumentTokens);
      ticker!.setMode(ticker!.modeQuote, instrumentTokens);
      
      sendEvent({ 
        type: "connected", 
        instruments: instrumentTokens.length,
        timestamp: new Date().toISOString() 
      });
    });

    ticker.on("ticks", (ticks: KiteTickData[]) => {
      for (const tick of ticks) {
        sendEvent({
          type: "tick",
          data: {
            token: tick.instrument_token,
            ltp: tick.last_price,
            open: tick.ohlc?.open,
            high: tick.ohlc?.high,
            low: tick.ohlc?.low,
            close: tick.ohlc?.close,
            volume: tick.volume,
            change: tick.change,
            oi: tick.oi,
            timestamp: new Date().toISOString(),
          }
        });
      }
    });

    (ticker as any).on("disconnect", (code: number) => {
      console.log(`[Stream] Disconnected with code ${code}`);
      isConnected = false;
      sendEvent({ type: "disconnected", code });
    });

    ticker.on("error", (error: Error) => {
      console.error("[Stream] Error:", error.message);
      sendEvent({ type: "error", message: error.message });
    });

    ticker.on("noreconnect", () => {
      console.log("[Stream] Max reconnect attempts reached");
      sendEvent({ type: "max_reconnect", message: "Connection lost, please refresh" });
      cleanup();
    });

    ticker.connect();

    heartbeatInterval = setInterval(() => {
      if (isConnected) {
        sendEvent({ type: "heartbeat", timestamp: new Date().toISOString() });
      }
    }, 30000);

    request.signal.onabort = () => {
      console.log(`[Stream] Client disconnected: ${user.userId}`);
      cleanup();
    };

  } catch (error) {
    console.error("[Stream] Setup error:", error);
    sendEvent({ type: "error", message: "Failed to establish connection" });
    await cleanup();
    return new Response("Failed to connect", { status: 500 });
  }

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
