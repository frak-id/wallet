import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke } from "../tauri";

/**
 * Bridge to the local `tauri-plugin-frak-firebase` plugin (Crashlytics half).
 *
 * The facade is `undefined` outside Tauri mobile, so callers must use `?.`.
 * Failures are swallowed: Crashlytics is an observability sink, never a
 * critical-path dependency.
 */

const INVOKE_SET_USER_ID = "plugin:frak-firebase|set_user_id";
const INVOKE_SET_KEY = "plugin:frak-firebase|set_key";
const INVOKE_LOG = "plugin:frak-firebase|log";
const INVOKE_RECORD_ERROR = "plugin:frak-firebase|record_error";
const INVOKE_SET_COLLECTION_ENABLED =
    "plugin:frak-firebase|set_collection_enabled";
const INVOKE_TEST_CRASH_NATIVE = "plugin:frak-firebase|test_crash_native";
const INVOKE_TEST_RUST_PANIC = "plugin:frak-firebase|test_rust_panic";

async function safeInvoke(
    cmd: string,
    label: string,
    args?: Record<string, unknown>
): Promise<void> {
    try {
        const invoke = await getInvoke();
        await invoke<void>(cmd, args);
    } catch (err) {
        console.warn(`crashlytics.${label} failed`, err);
    }
}

/**
 * Stringify on the JS side so the dashboard stays uniform across the two
 * native APIs, which each coerce heterogeneous values their own way.
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

export const crashlytics = !IS_TAURI
    ? undefined
    : {
          /** Pass an empty string to clear the user on logout. */
          async setUserId(userId: string): Promise<void> {
              await safeInvoke(INVOKE_SET_USER_ID, "setUserId", { userId });
          },

          /** Crashlytics keeps up to 64 keys per app, evicted FIFO. */
          async setKey(key: string, value: unknown): Promise<void> {
              await safeInvoke(INVOKE_SET_KEY, "setKey", {
                  key,
                  value: stringifyValue(value),
              });
          },

          /** Breadcrumb; the next report carries the most recent ~64 KB. */
          async log(message: string): Promise<void> {
              await safeInvoke(INVOKE_LOG, "log", { message });
          },

          /**
           * Record a non-fatal error. `stack` rides along as a breadcrumb —
           * Crashlytics groups on `name` + `message` only.
           */
          async recordError(err: unknown): Promise<void> {
              const error = err instanceof Error ? err : new Error(String(err));
              await safeInvoke(INVOKE_RECORD_ERROR, "recordError", {
                  name: error.name || "Error",
                  message: error.message || "",
                  stack: error.stack,
              });
          },

          /** Takes effect on the next app start (Firebase SDK behaviour). */
          async setCollectionEnabled(enabled: boolean): Promise<void> {
              await safeInvoke(
                  INVOKE_SET_COLLECTION_ENABLED,
                  "setCollectionEnabled",
                  { enabled }
              );
          },

          /**
           * Smoke test: kills the current session with a real native crash
           * (SIGABRT on iOS, uncaught exception on Android). Wire to a hidden
           * debug button only.
           */
          async testCrashNative(): Promise<void> {
              await safeInvoke(INVOKE_TEST_CRASH_NATIVE, "testCrashNative");
          },

          /**
           * Smoke test for the panic-hook → disk → next-launch pipeline. In
           * release builds (`panic = "abort"`) the process dies too. Wire to
           * a hidden debug button only.
           */
          async testRustPanic(): Promise<void> {
              await safeInvoke(INVOKE_TEST_RUST_PANIC, "testRustPanic");
          },
      };
