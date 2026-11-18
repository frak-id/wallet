import { createPinoLogger } from "@bogeychan/elysia-logger";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { redactQueryParams } from "@frak-labs/app-essentials/utils/redactQueryParams";

/**
 * Create a logger instance
 */
export const log = createPinoLogger({
    name: "elysia",
    level: process.env.LOG_LEVEL ?? "debug",
    // Drizzle errors carry bound values; this also covers the request logger's onError line
    hooks: {
        logMethod(args, method) {
            redactQueryParams(args);
            method.apply(this, args);
        },
    },
    transport: isRunningLocally
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
              },
          }
        : undefined,
});
