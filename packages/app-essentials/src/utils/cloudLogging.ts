const SEVERITY_BY_LEVEL = new Map([
    ["trace", "DEBUG"],
    ["debug", "DEBUG"],
    ["info", "INFO"],
    ["warn", "WARNING"],
    ["error", "ERROR"],
    ["fatal", "CRITICAL"],
]);

/** Cloud Logging severity for a pino level label; unknown labels are `DEFAULT`. */
export function toCloudSeverity(label: string): string {
    return SEVERITY_BY_LEVEL.get(label) ?? "DEFAULT";
}

/**
 * pino options so Cloud Logging reads `severity` and `message`. Spread them
 * where no pino-pretty transport is attached: `formatters.level` drops the
 * `level` key and `messageKey` renames `msg`, which pino-pretty reads.
 */
export const cloudLoggingOptions = {
    messageKey: "message",
    formatters: {
        level(label: string) {
            return { severity: toCloudSeverity(label) };
        },
    },
};
