/**
 * Redis configuration - ONLY for Railway workers
 * This file should NOT be imported in Vercel-deployed code
 * 
 * For Vercel deployments, use Supabase Realtime instead
 */

export const REDIS_KEYS = {
  LATEST_TICK: (token: number) => `latest_tick:${token}`,
  LIVE_CANDLE: (token: number, timeframe: string) => `live_candle:${token}:${timeframe}`,
  TICK_CHANNEL: (token: number) => `ticker:${token}`,
  CANDLE_CHANNEL: (token: number, timeframe: string) => `candles:${timeframe}:${token}`,
  CANDLE_LIST: (token: number, timeframe: string) => `candle_list:${token}:${timeframe}`,
  TRADING_PREFS: (userId: string) => `trading_prefs:${userId}`,
};

let redisInstance: any = null;
let redisSubInstance: any = null;

function isRailwayEnvironment(): boolean {
  return process.env.RAILWAY_ENVIRONMENT !== undefined || 
         process.env.RAILWAY_SERVICE_NAME !== undefined;
}

async function getRedisClient() {
  if (!isRailwayEnvironment()) {
    console.warn("[Redis] Not in Railway environment - Redis operations will be skipped");
    return null;
  }

  if (!redisInstance) {
    const Redis = (await import("ioredis")).default;
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    redisInstance.on("connect", () => console.log("[Redis] Main client connected"));
    redisInstance.on("error", (err: Error) => console.error("[Redis] Main client error:", err));
  }
  return redisInstance;
}

async function getRedisSubscriber() {
  if (!isRailwayEnvironment()) {
    return null;
  }

  if (!redisSubInstance) {
    const Redis = (await import("ioredis")).default;
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisSubInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    redisSubInstance.on("connect", () => console.log("[Redis] Subscriber client connected"));
    redisSubInstance.on("error", (err: Error) => console.error("[Redis] Subscriber client error:", err));
  }
  return redisSubInstance;
}

export async function syncTradingPreferenceToRedis(userId: string, data: any): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const key = REDIS_KEYS.TRADING_PREFS(userId);
    await redis.set(key, JSON.stringify(data), "EX", 86400);
  } catch (err) {
    console.error(`[Redis] Failed to sync trading prefs for ${userId}:`, err);
  }
}

export { getRedisClient as redis, getRedisSubscriber as redisSub };
