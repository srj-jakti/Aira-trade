"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const currentLevel = process.env.LOG_LEVEL || "info";
function log(level, message, data) {
    if (LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}][TradingEngine][${level.toUpperCase()}]`;
        if (data) {
            console.log(`${prefix} ${message}`, JSON.stringify(data));
        }
        else {
            console.log(`${prefix} ${message}`);
        }
    }
}
exports.logger = {
    debug: (message, data) => log("debug", message, data),
    info: (message, data) => log("info", message, data),
    warn: (message, data) => log("warn", message, data),
    error: (message, data) => log("error", message, data),
};
//# sourceMappingURL=logger.js.map