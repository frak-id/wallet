/**
 * Centralized lazy bridge to `@tauri-apps/api/core`.
 *
 * Memoizes the dynamic import so every plugin call site shares the same
 * resolved `invoke` function instead of re-walking the module graph on every
 * roundtrip. Callers should remain platform-guarded (`IS_TAURI` / `IS_IOS`
 * / `IS_ANDROID`) — this helper does NOT assume Tauri is available; it just
 * stops the duplicate `await import("@tauri-apps/api/core")` boilerplate.
 *
 * The `IS_TAURI` short-circuit is critical for tree-shaking: in non-Tauri
 * builds (web wallet, listener) `IS_TAURI` collapses to a `false` literal,
 * which lets Rolldown DCE every call-site that goes through `getInvoke()`.
 * A small residual `invoke` channel from `@tauri-apps/api/core` may remain
 * in the shared chunk because Rolldown plans the dynamic-import chunk graph
 * before constant folding — that chunk is orphaned at runtime.
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

import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";

type InvokeFn = typeof import("@tauri-apps/api/core").invoke;

let invokePromise: Promise<InvokeFn> | null = null;

/**
 * Returns the memoized Tauri `invoke` function.
 *
 * The first call triggers the dynamic import; subsequent calls reuse the
 * resolved promise so there's no per-call module-graph walk. Rejects
 * immediately when invoked outside the Tauri runtime — callers must
 * platform-guard before `await getInvoke()`.
 *
 * The `IS_TAURI` check is evaluated per-call (not at module load) so that
 * tests can flip the mocked platform value between cases without re-importing
 * the bridge.
 */
export function getInvoke(): Promise<InvokeFn> {
    if (!IS_TAURI) {
        return Promise.reject(
            new Error(
                "Tauri bridge accessed outside of the Tauri runtime—call sites must be guarded by IS_TAURI."
            )
        );
    }
    if (!invokePromise) {
        invokePromise = import("@tauri-apps/api/core").then((m) => m.invoke);
    }
    return invokePromise;
}
