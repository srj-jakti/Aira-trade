"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDIS_KEYS = exports.redis = void 0;
exports.cleanupDayEndData = cleanupDayEndData;
exports.isMarketClosed = isMarketClosed;
exports.scheduleMarketCloseCleanup = scheduleMarketCloseCleanup;
const ioredis_1 = __importDefault(require("ioredis"));
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
    console.warn("[Redis] REDIS_URL not found in environment variables");
}
exports.redis = new ioredis_1.default(redisUrl || "redis://localhost:6379", {
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
exports.redis.on("connect", () => console.log("[Redis] Connected successfully"));
exports.redis.on("ready", () => console.log("[Redis] Ready to accept commands"));
exports.redis.on("error", (err) => console.error("[Redis] Error:", err.message));
exports.redis.on("close", () => console.log("[Redis] Connection closed"));
exports.redis.on("reconnecting", () => console.log("[Redis] Reconnecting..."));
exports.REDIS_KEYS = {
    LATEST_TICK: (token) => `latest_tick:${token}`,
    LIVE_CANDLE: (token, timeframe) => `live_candle:${token}:${timeframe}`,
    TICK_CHANNEL: (token) => `ticker:${token}`,
    CANDLE_CHANNEL: (token, timeframe) => `candles:${timeframe}:${token}`,
    CANDLE_LIST: (token, timeframe) => `candle_list:${token}:${timeframe}`,
    MARKET_DATA_HEARTBEAT: "market_data:heartbeat",
    DAY_CLEANUP_LOCK: "market_data:day_cleanup_lock",
};
async function cleanupDayEndData() {
    console.log("[Redis] Starting day-end data cleanup...");
    let ticksDeleted = 0;
    let candlesDeleted = 0;
    try {
        const lockKey = exports.REDIS_KEYS.DAY_CLEANUP_LOCK;
        const lockAcquired = await exports.redis.set(lockKey, "1", "EX", 300, "NX");
        if (!lockAcquired) {
            console.log("[Redis] Day-end cleanup already in progress");
            return { ticksDeleted: 0, candlesDeleted: 0 };
        }
        const tickKeys = await exports.redis.keys("latest_tick:*");
        if (tickKeys.length > 0) {
            ticksDeleted = await exports.redis.del(...tickKeys);
            console.log(`[Redis] Deleted ${ticksDeleted} tick cache entries`);
        }
        const candleKeys = await exports.redis.keys("live_candle:*");
        if (candleKeys.length > 0) {
            candlesDeleted += await exports.redis.del(...candleKeys);
        }
        const candleListKeys = await exports.redis.keys("candle_list:*");
        if (candleListKeys.length > 0) {
            candlesDeleted += await exports.redis.del(...candleListKeys);
            console.log(`[Redis] Deleted ${candlesDeleted} candle cache entries`);
        }
        await exports.redis.del(lockKey);
        console.log(`[Redis] Day-end cleanup complete: ${ticksDeleted} ticks, ${candlesDeleted} candles cleared`);
    }
    catch (err) {
        console.error("[Redis] Day-end cleanup error:", err);
    }
    return { ticksDeleted, candlesDeleted };
}
function isMarketClosed() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const day = istTime.getUTCDay();
    if (day === 0 || day === 6)
        return true;
    const currentMins = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15;
    const marketClose = 15 * 60 + 30;
    return currentMins < marketOpen || currentMins > marketClose;
}
async function scheduleMarketCloseCleanup() {
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
//# sourceMappingURL=redis.js.map