import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke } from "../tauri";

/**
 * Bridge to the local `tauri-plugin-frak-crashlytics` plugin.
 *
 * Forwards user identification, custom keys, breadcrumb logs and non-fatal
 * errors to Firebase Crashlytics on iOS and Android. All calls are no-ops
 * outside Tauri mobile so it's safe to invoke them from shared code.
 *
 * Native (NSException, JVM uncaught, NDK signal) crash capture is wired by
 * the Crashlytics SDK itself — this module only adds the **context** that
 * makes those reports actionable.
 *
 * Failures are swallowed and surfaced to the console so a misconfigured
 * Firebase project can't take down the calling code path. Crashlytics is
 * an observability sink, not a critical-path dependency.
 */

const INVOKE_SET_USER_ID = "plugin:frak-crashlytics|set_user_id";
const INVOKE_SET_KEY = "plugin:frak-crashlytics|set_key";
const INVOKE_LOG = "plugin:frak-crashlytics|log";
const INVOKE_RECORD_ERROR = "plugin:frak-crashlytics|record_error";
const INVOKE_SET_COLLECTION_ENABLED =
    "plugin:frak-crashlytics|set_collection_enabled";

async function tauriInvoke<T>(cmd: string, args?: unknown): Promise<T> {
    const invoke = await getInvoke();
    return invoke<T>(cmd, args as Record<string, unknown> | undefined);
}

/**
 * Coerce arbitrary key values to a string. Crashlytics native APIs accept
 * heterogeneous types but stringifying on the JS side keeps the dashboard
 * uniform and avoids platform-specific surprises (e.g. `Boolean(true)` vs
 * `"true"`). Numbers / booleans / Date are passed through `String()`;
 * objects fall back to JSON.
 */
function stringifyValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (
        typeof value === "number" ||
        typeof value === "boolean" ||
        typeof value === "bigint"
    ) {
        return String(value);
    }
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export const crashlytics = {
    /**
     * Identify the current user (typically the wallet address). Pass an
     * empty string to clear it on logout.
     */
    async setUserId(userId: string): Promise<void> {
        if (!isTauri()) return;
        try {
            await tauriInvoke<void>(INVOKE_SET_USER_ID, { userId });
        } catch (err) {
            console.warn("crashlytics.setUserId failed", err);
        }
    },

    /**
     * Attach a custom key/value to subsequent crash reports. Useful for
     * splits like `env`, `feature_flag`, `last_route`. Crashlytics keeps
     * up to 64 keys per app — old keys are evicted FIFO once the cap is hit.
     */
    async setKey(key: string, value: unknown): Promise<void> {
        if (!isTauri()) return;
        try {
            await tauriInvoke<void>(INVOKE_SET_KEY, {
                key,
                value: stringifyValue(value),
            });
        } catch (err) {
            console.warn("crashlytics.setKey failed", err);
        }
    },

    /**
     * Append a breadcrumb log entry. The next crash report will include
     * the most recent ~64 KB of logs. Prefer short, structured messages
     * over verbose dumps.
     */
    async log(message: string): Promise<void> {
        if (!isTauri()) return;
        try {
            await tauriInvoke<void>(INVOKE_LOG, { message });
        } catch (err) {
            console.warn("crashlytics.log failed", err);
        }
    },

    /**
     * Record a non-fatal error. Shows up in Crashlytics under the same
     * dashboard as fatal crashes, distinguished by the "non-fatal" badge.
     *
     * The original error's `stack` is attached as a breadcrumb on the next
     * report so the JS frames survive the native bridge — Crashlytics's own
     * exception-grouping uses `name` + `message`.
     */
    async recordError(err: unknown): Promise<void> {
        if (!isTauri()) return;
        try {
            const error = err instanceof Error ? err : new Error(String(err));
            await tauriInvoke<void>(INVOKE_RECORD_ERROR, {
                name: error.name || "Error",
                message: error.message || "",
                stack: error.stack,
            });
        } catch (innerErr) {
            console.warn("crashlytics.recordError failed", innerErr);
        }
    },

    /**
     * Toggle Crashlytics collection at runtime. Takes effect on the next
     * app start (per Firebase SDK behaviour). Use this to back a Settings
     * opt-out toggle.
     */
    async setCollectionEnabled(enabled: boolean): Promise<void> {
        if (!isTauri()) return;
        try {
            await tauriInvoke<void>(INVOKE_SET_COLLECTION_ENABLED, { enabled });
        } catch (err) {
            console.warn("crashlytics.setCollectionEnabled failed", err);
        }
    },
};
