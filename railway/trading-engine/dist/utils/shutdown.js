"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShutdownFlag = getShutdownFlag;
exports.setShutdownFlag = setShutdownFlag;
exports.setupGracefulShutdown = setupGracefulShutdown;
const logger_1 = require("./logger");
let isShuttingDown = false;
function getShutdownFlag() {
    return isShuttingDown;
}
function setShutdownFlag(value) {
    isShuttingDown = value;
}
function setupGracefulShutdown(cleanupFn) {
    const shutdown = async (signal) => {
        if (isShuttingDown)
            return;
        logger_1.logger.info(`Received ${signal}, initiating graceful shutdown...`);
        isShuttingDown = true;
        try {
            await cleanupFn();
            logger_1.logger.info("Shutdown complete");
            process.exit(0);
        }
        catch (error) {
            logger_1.logger.error("Error during shutdown", error);
            process.exit(1);
        }
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("uncaughtException", (err) => {
        logger_1.logger.error("Uncaught exception", err);
    });
    process.on("unhandledRejection", (err) => {
        logger_1.logger.error("Unhandled rejection", err);
    });
}
//# sourceMappingURL=shutdown.js.map