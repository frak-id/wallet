import { describe, expect, it } from "vitest";
import { cloudLoggingOptions, toCloudSeverity } from "./cloudLogging";

describe("toCloudSeverity", () => {
    it.each([
        ["trace", "DEBUG"],
        ["debug", "DEBUG"],
        ["info", "INFO"],
        ["warn", "WARNING"],
        ["error", "ERROR"],
        ["fatal", "CRITICAL"],
    ])("maps %s to %s", (label, severity) => {
        expect(toCloudSeverity(label)).toBe(severity);
    });

    it("falls back to DEFAULT for an unknown label", () => {
        expect(toCloudSeverity("audit")).toBe("DEFAULT");
        expect(toCloudSeverity("toString")).toBe("DEFAULT");
    });
});

describe("cloudLoggingOptions", () => {
    it("writes the message under `message`", () => {
        expect(cloudLoggingOptions.messageKey).toBe("message");
    });

    it("replaces the level with a severity", () => {
        expect(cloudLoggingOptions.formatters.level("warn")).toEqual({
            severity: "WARNING",
        });
    });
});
