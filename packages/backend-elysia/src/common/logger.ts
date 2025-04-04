import { createPinoLogger } from "@bogeychan/elysia-logger";
import { isRunningLocally } from "@frak-labs/app-essentials";

/**
 * Create a logger instance
 */
export const log = createPinoLogger({
    name: "elysia",
    level: process.env.LOG_LEVEL ?? "debug",
    transport: isRunningLocally
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
              },
          }
        : undefined,
});
