import { logger } from "./logger";

let isShuttingDown = false;

export function getShutdownFlag(): boolean {
  return isShuttingDown;
}

export function setShutdownFlag(value: boolean): void {
  isShuttingDown = value;
}

export function setupGracefulShutdown(cleanupFn: () => Promise<void>): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    isShuttingDown = true;
    
    try {
      await cleanupFn();
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", err);
  });

  process.on("unhandledRejection", (err) => {
    logger.error("Unhandled rejection", err);
  });
}
