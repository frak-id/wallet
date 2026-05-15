import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke } from "../tauri";

/**
 * Bridge to the local `tauri-plugin-frak-firebase` plugin (Crashlytics half).
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

const INVOKE_SET_USER_ID = "plugin:frak-firebase|set_user_id";
const INVOKE_SET_KEY = "plugin:frak-firebase|set_key";
const INVOKE_LOG = "plugin:frak-firebase|log";
const INVOKE_RECORD_ERROR = "plugin:frak-firebase|record_error";
const INVOKE_SET_COLLECTION_ENABLED =
    "plugin:frak-firebase|set_collection_enabled";
// Smoke-test commands — deliberately produce a crash so the Crashlytics
// dashboard end-to-end wiring can be verified on TestFlight / Play Internal
// builds (matching signing identity → matching dSYM/mapping upload).
const INVOKE_TEST_CRASH_NATIVE = "plugin:frak-firebase|test_crash_native";
const INVOKE_TEST_RUST_PANIC = "plugin:frak-firebase|test_rust_panic";

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

export const crashlytics = !IS_TAURI
    ? undefined
    : {
          /**
           * Identify the current user (typically the wallet address). Pass an
           * empty string to clear it on logout.
           */
          async setUserId(userId: string): Promise<void> {
              if (!IS_TAURI) return;
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
              if (!IS_TAURI) return;
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
              if (!IS_TAURI) return;
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
              if (!IS_TAURI) return;
              try {
                  const error =
                      err instanceof Error ? err : new Error(String(err));
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
              if (!IS_TAURI) return;
              try {
                  await tauriInvoke<void>(INVOKE_SET_COLLECTION_ENABLED, {
                      enabled,
                  });
              } catch (err) {
                  console.warn("crashlytics.setCollectionEnabled failed", err);
              }
          },

          /**
           * Smoke-test: trigger a synthetic *native* fatal so the
           * Crashlytics dashboard end-to-end wiring can be verified.
           *
           * On iOS this calls `Crashlytics.crashlytics().crash()` which
           * raises `SIGABRT`; on Android it throws an uncaught
           * `RuntimeException` from the main thread. Either way the SDK's
           * signal/exception handler captures the crash, persists it, and
           * uploads it on the next launch. **The current session dies.**
           *
           * Do NOT call from production code paths. Wire to a hidden
           * settings / debug button so it can only be triggered intentionally.
           */
          async testCrashNative(): Promise<void> {
              if (!IS_TAURI) return;
              try {
                  await tauriInvoke<void>(INVOKE_TEST_CRASH_NATIVE);
              } catch (err) {
                  console.warn("crashlytics.testCrashNative failed", err);
              }
          },

          /**
           * Smoke-test: trigger a synthetic *Rust* panic so the panic-hook
           * → disk → next-launch forwarding pipeline can be verified.
           *
           * In release builds (`panic = "abort"`) this also crashes the
           * process via `SIGABRT`, so Crashlytics records two reports across
           * two launches:
           *   - fatal native crash (this launch)
           *   - non-fatal `RustPanic` issue with the persisted JSON payload
           *     (next launch — the native plugin reads + reports + deletes)
           *
           * In dev builds (`panic = "unwind"`) the JS promise rejects, the
           * panic hook still writes to disk, and you only see the non-fatal
           * on the next launch.
           *
           * Same warning as `testCrashNative` — do NOT call from production.
           */
          async testRustPanic(): Promise<void> {
              if (!IS_TAURI) return;
              try {
                  await tauriInvoke<void>(INVOKE_TEST_RUST_PANIC);
              } catch (err) {
                  // Expected in dev builds (panic="unwind" → promise rejects).
                  // Release builds never reach here — the process dies first.
                  console.warn("crashlytics.testRustPanic returned", err);
              }
          },
      };
