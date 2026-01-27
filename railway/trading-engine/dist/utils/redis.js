"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDIS_KEYS = exports.redis = void 0;
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
};
//# sourceMappingURL=redis.js.map