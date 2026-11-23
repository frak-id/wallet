import { createPinoLogger, formatters } from "@bogeychan/elysia-logger";
import { cloudLoggingOptions } from "@frak-labs/app-essentials/utils/cloudLogging";
import { describe, expect, it } from "vitest";

function captureLogger() {
    const lines: Record<string, unknown>[] = [];
    const log = createPinoLogger({
        level: "trace",
        ...cloudLoggingOptions,
        formatters: { ...formatters, ...cloudLoggingOptions.formatters },
        stream: {
            write(chunk: string) {
                lines.push(JSON.parse(chunk));
            },
        },
    });
    return { log, lines };
}

describe("cloud logging options on the backend pino logger", () => {
    it.each([
        ["trace", "DEBUG"],
        ["debug", "DEBUG"],
        ["info", "INFO"],
        ["warn", "WARNING"],
        ["error", "ERROR"],
        ["fatal", "CRITICAL"],
    ] as const)("%s entries carry severity %s", (level, severity) => {
        const { log, lines } = captureLogger();
        log[level]("hello");

        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ severity, message: "hello" });
        expect(lines[0]).not.toHaveProperty("level");
        expect(lines[0]).not.toHaveProperty("msg");
    });

    it("keeps the plugin's request formatter", () => {
        const { log, lines } = captureLogger();
        log.info(new Request("https://frak.id/health"), "req");

        expect(lines[0]).toMatchObject({
            severity: "INFO",
            message: "req",
            method: "GET",
            url: "https://frak.id/health",
        });
    });
});
