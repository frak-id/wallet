import { createPinoLogger } from "@bogeychan/elysia-logger";
import { isRunningLocally } from "@frak-labs/app-essentials";

export const log = createPinoLogger({
    name: "api-v2",
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
