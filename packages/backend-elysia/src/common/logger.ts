import { createPinoLogger } from "@bogeychan/elysia-logger";

/**
 * Create a logger instance
 */
export const log = createPinoLogger({
    name: "elysia",
    level: process.env.LOG_LEVEL ?? "debug",
});
