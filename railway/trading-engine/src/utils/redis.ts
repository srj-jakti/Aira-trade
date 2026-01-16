import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn("[Redis] REDIS_URL not found in environment variables");
}

export const redis = new Redis(redisUrl || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 10) {
      console.error("[Redis] Max retries reached, giving up");
      return null;
    }
    return Math.min(times * 200, 5000);
  },
  reconnectOnError: (err) => {
    console.error("[Redis] Reconnect on error:", err.message);
    return true;
  },
});

redis.on("connect", () => console.log("[Redis] Connected successfully"));
redis.on("ready", () => console.log("[Redis] Ready to accept commands"));
redis.on("error", (err) => console.error("[Redis] Error:", err.message));
redis.on("close", () => console.log("[Redis] Connection closed"));
redis.on("reconnecting", () => console.log("[Redis] Reconnecting..."));

export const REDIS_KEYS = {
  LATEST_TICK: (token: number) => `latest_tick:${token}`,
  LIVE_CANDLE: (token: number, timeframe: string) => `live_candle:${token}:${timeframe}`,
  TICK_CHANNEL: (token: number) => `ticker:${token}`,
  CANDLE_CHANNEL: (token: number, timeframe: string) => `candles:${timeframe}:${token}`,
  CANDLE_LIST: (token: number, timeframe: string) => `candle_list:${token}:${timeframe}`,
};
