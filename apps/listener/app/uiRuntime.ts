/**
 * Ring 0 → Ring 1 dynamic boot bridge.
 *
 * `ensureUiRuntime()` lazy-imports `app/ui/runtime` (which pulls preact +
 * i18next + the provider stack into a single Ring 1 chunk) and mounts the
 * Preact tree. Idempotent — subsequent calls reuse the same Promise so a
 * partner site that fires multiple `frak_displayModal` calls in quick
 * succession does not race the import.
 *
 * Keep this module dependency-free (no preact, no react) so it stays in
 * the eager bundle.
 */

let runtimePromise: Promise<unknown> | null = null;

export function ensureUiRuntime(): Promise<unknown> {
    if (runtimePromise) return runtimePromise;
    runtimePromise = import("@/ui/runtime").then((mod) => {
        mod.mountUiRuntime();
    });
    return runtimePromise;
}
