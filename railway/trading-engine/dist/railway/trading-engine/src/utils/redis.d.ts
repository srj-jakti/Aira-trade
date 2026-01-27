import Redis from "ioredis";
export declare const redis: Redis;
export declare const REDIS_KEYS: {
    LATEST_TICK: (token: number) => string;
    LIVE_CANDLE: (token: number, timeframe: string) => string;
    TICK_CHANNEL: (token: number) => string;
    CANDLE_CHANNEL: (token: number, timeframe: string) => string;
    CANDLE_LIST: (token: number, timeframe: string) => string;
};
//# sourceMappingURL=redis.d.ts.map