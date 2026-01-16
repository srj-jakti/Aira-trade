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
  MARKET_DATA_HEARTBEAT: "market_data:heartbeat",
  DAY_CLEANUP_LOCK: "market_data:day_cleanup_lock",
};

export async function cleanupDayEndData(): Promise<{ ticksDeleted: number; candlesDeleted: number }> {
  console.log("[Redis] Starting day-end data cleanup...");
  
  let ticksDeleted = 0;
  let candlesDeleted = 0;
  
  try {
    const lockKey = REDIS_KEYS.DAY_CLEANUP_LOCK;
    const lockAcquired = await redis.set(lockKey, "1", "EX", 300, "NX");
    if (!lockAcquired) {
      console.log("[Redis] Day-end cleanup already in progress");
      return { ticksDeleted: 0, candlesDeleted: 0 };
    }

    const tickKeys = await redis.keys("latest_tick:*");
    if (tickKeys.length > 0) {
      ticksDeleted = await redis.del(...tickKeys);
      console.log(`[Redis] Deleted ${ticksDeleted} tick cache entries`);
    }

    const candleKeys = await redis.keys("live_candle:*");
    if (candleKeys.length > 0) {
      candlesDeleted += await redis.del(...candleKeys);
    }

    const candleListKeys = await redis.keys("candle_list:*");
    if (candleListKeys.length > 0) {
      candlesDeleted += await redis.del(...candleListKeys);
      console.log(`[Redis] Deleted ${candlesDeleted} candle cache entries`);
    }

    await redis.del(lockKey);
    
    console.log(`[Redis] Day-end cleanup complete: ${ticksDeleted} ticks, ${candlesDeleted} candles cleared`);
  } catch (err) {
    console.error("[Redis] Day-end cleanup error:", err);
  }
  
  return { ticksDeleted, candlesDeleted };
}

export function isMarketClosed(): boolean {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const day = istTime.getUTCDay();
  
  if (day === 0 || day === 6) return true;
  
  const currentMins = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15;
  const marketClose = 15 * 60 + 30;
  
  return currentMins < marketOpen || currentMins > marketClose;
}

export async function scheduleMarketCloseCleanup(): Promise<void> {
  const checkCleanup = async () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    
    if (hours === 15 && minutes >= 35 && minutes <= 45) {
      console.log("[Redis] Market just closed, triggering cleanup...");
      await cleanupDayEndData();
    }
  };
  
  setInterval(checkCleanup, 60000);
  console.log("[Redis] Market close cleanup scheduler started");
}
