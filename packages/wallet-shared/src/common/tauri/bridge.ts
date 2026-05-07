/**
 * Centralized lazy bridge to `@tauri-apps/api/core`.
 *
 * Memoizes the dynamic import so every plugin call site shares the same
 * resolved `invoke` function instead of re-walking the module graph on every
 * roundtrip. Callers should remain platform-guarded (`isTauri()` / `isIOS()`
 * / `isAndroid()`) — this helper does NOT assume Tauri is available; it just
 * stops the duplicate `await import("@tauri-apps/api/core")` boilerplate.
 *
 * Pattern:
 *
 * ```ts
 * import { getInvoke } from "@frak-labs/wallet-shared";
 *
 * const invoke = await getInvoke();
 * const result = await invoke<ResponseShape>("plugin:foo|bar", payload);
 * ```
 */

type InvokeFn = typeof import("@tauri-apps/api/core").invoke;

let invokePromise: Promise<InvokeFn> | null = null;

/**
 * Returns the memoized Tauri `invoke` function.
 *
 * The first call triggers the dynamic import; subsequent calls reuse the
 * resolved promise so there's no per-call module-graph walk.
 */
export function getInvoke(): Promise<InvokeFn> {
    if (!invokePromise) {
        invokePromise = import("@tauri-apps/api/core").then((m) => m.invoke);
    }
    return invokePromise;
}
