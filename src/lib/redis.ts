import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn("[Redis] REDIS_URL not found in environment variables");
}

export const redis = new Redis(redisUrl || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// For Pub/Sub we often need a separate client
export const redisSub = new Redis(redisUrl || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("connect", () => console.log("[Redis] Main client connected"));
redis.on("error", (err) => console.error("[Redis] Main client error:", err));

redisSub.on("connect", () => console.log("[Redis] Subscriber client connected"));
redisSub.on("error", (err) => console.error("[Redis] Subscriber client error:", err));

export const REDIS_KEYS = {
  LATEST_TICK: (token: number) => `latest_tick:${token}`,
  LIVE_CANDLE: (token: number, timeframe: string) => `live_candle:${token}:${timeframe}`,
  TICK_CHANNEL: (token: number) => `ticker:${token}`,
  CANDLE_CHANNEL: (token: number, timeframe: string) => `candles:${timeframe}:${token}`,
  CANDLE_LIST: (token: number, timeframe: string) => `candle_list:${token}:${timeframe}`,
};
