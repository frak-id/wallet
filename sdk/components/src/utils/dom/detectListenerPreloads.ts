import type { ListenerPreloadOption } from "@frak-labs/core-sdk";

/**
 * Tags that count as "Frak components" for the purpose of preload detection.
 *
 * Kept in sync with the registry in `bootstrap/loader.ts#COMPONENTS_MAP` —
 * any new public custom element should be added here too so the iframe
 * preload hash reflects the user's actual page surface.
 */
const FRAK_COMPONENT_SELECTOR = [
    "frak-button-share",
    "frak-button-wallet",
    "frak-open-in-app",
    "frak-post-purchase",
    "frak-banner",
].join(",");

/**
 * Dynamically compute the iframe preload list based on which Frak components
 * are present in the current document.
 *
 * Behaviour:
 *  - No `frak-*` element on the page → `[]` (caller should skip the
 *    `#preload=...` hash entirely so the listener doesn't warm chunks no one
 *    will use).
 *  - At least one `frak-*` element → `["sharing"]`. Every public component
 *    eventually opens the sharing flow (directly via `<frak-button-share>` or
 *    indirectly via wallet/post-purchase/banner CTAs), so a single hint
 *    covers the whole surface without bloating the iframe URL.
 *
 * Called once during {@link initFrakSdk}, before {@link setupClient} creates
 * the iframe. Dynamically-mounted components (added after init) still work —
 * the listener loads handlers on demand — they just skip the warm-up.
 */
export function detectListenerPreloads(): ListenerPreloadOption[] {
    if (typeof document === "undefined") return [];

    const hasFrakComponent =
        document.querySelector(FRAK_COMPONENT_SELECTOR) !== null;

    return hasFrakComponent ? ["sharing"] : [];
}
