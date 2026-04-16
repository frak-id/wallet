import type { AttributionDefaults, AttributionParams } from "../types/tracking";

/**
 * Inputs for {@link mergeAttribution}.
 */
export type MergeAttributionInput = {
    /**
     * Per-call attribution override passed to actions like `displaySharingPage`.
     *
     * - `null` explicitly disables attribution (no UTM/ref/via params are added).
     * - `undefined` means "no per-call override" — defaults apply if present.
     * - An object (including `{}`) merges field-by-field with defaults.
     */
    perCall: AttributionParams | null | undefined;
    /**
     * Pre-merged merchant-level defaults (backend config > SDK static config).
     * `utm_content` is intentionally absent from this shape.
     */
    defaults?: AttributionDefaults;
    /**
     * Per-product `utm_content` override (from the currently selected
     * `SharingPageProduct`). Takes precedence over `perCall.utmContent`.
     */
    productUtmContent?: string;
};

/**
 * Merge the three attribution layers into a single {@link AttributionParams}
 * value suitable for `FrakContextManager.update`.
 *
 * Priority per field:
 *   1. `perCall` (wins)
 *   2. `defaults` (merchant-level, backend > SDK static, already pre-merged)
 *   3. Hardcoded fallbacks resolved later by `FrakContextManager`
 *
 * Special rules:
 * - `perCall === null` returns `undefined` (explicit disable: no UTM/ref/via).
 * - `perCall === undefined` (no opinion) yields at least `{}` so `FrakContextManager`
 *   applies its hardcoded defaults (utm_source=frak, utm_medium=referral,
 *   utm_campaign=<merchantId>, ref=<clientId>, via=frak).
 * - `utm_content` never comes from `defaults`; only `productUtmContent` or
 *   `perCall.utmContent` can populate it.
 */
export function mergeAttribution({
    perCall,
    defaults,
    productUtmContent,
}: MergeAttributionInput): AttributionParams | undefined {
    // Explicit disable
    if (perCall === null) return undefined;

    const hasPerCall = perCall !== undefined;
    const hasDefaults =
        defaults !== undefined && Object.keys(defaults).length > 0;
    const hasProductUtm =
        productUtmContent !== undefined && productUtmContent !== "";

    if (!hasPerCall && !hasDefaults && !hasProductUtm) return undefined;

    // Per-field merge: per-call wins over defaults.
    const merged: AttributionParams = {
        ...defaults,
        ...(perCall ?? {}),
    };

    // utm_content priority: productUtmContent > perCall.utmContent; never from defaults.
    const utmContent = productUtmContent ?? perCall?.utmContent;
    if (utmContent !== undefined && utmContent !== "") {
        merged.utmContent = utmContent;
    } else {
        delete merged.utmContent;
    }

    return merged;
}
