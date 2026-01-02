type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function log(level: LogLevel, message: string, data?: unknown): void {
  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}][TradingEngine][${level.toUpperCase()}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, JSON.stringify(data));
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

export const logger = {
  debug: (message: string, data?: unknown) => log("debug", message, data),
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
};
