import { createPinoLogger, formatters } from "@bogeychan/elysia-logger";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { cloudLoggingOptions } from "@frak-labs/app-essentials/utils/cloudLogging";
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
    ...(isRunningLocally
        ? {
              transport: {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                  },
              },
          }
        : {
              ...cloudLoggingOptions,
              // Passing `formatters` replaces the plugin's request/context `log` formatter
              formatters: { ...formatters, ...cloudLoggingOptions.formatters },
          }),
});
