/**
 * Pure, dependency-free constants shared by `infra/sdk-pointer.ts` (SST) and
 * `scripts/flip-sdk-pointer.ts` (release-time upload). No SST globals, no
 * Bun globals — this module must compile under plain `tsc` in both contexts.
 */

export type PointerStage = "prod" | "dev";

/** Bucket names and the `sdk[-dev].frak.id` aliases are global: only CI's two stages may own them. */
export function isPointerStage(stage: string): stage is PointerStage {
    return stage === "prod" || stage === "dev";
}

export const SDK_POINTER_SHIM_KEY = "components.js";

// jsDelivr purges the edge on release but a browser can hold the floating-tag
// response for up to 7 days — this pointer is what lets us shorten that.
export const SDK_POINTER_CACHE_CONTROL =
    "public, max-age=300, stale-while-revalidate=86400, stale-if-error=604800";

export function sdkPointerBucketName(stage: PointerStage): string {
    return `frak-sdk-pointer-${stage}`;
}

export function sdkPointerAlias(stage: PointerStage): string {
    return stage === "prod" ? "sdk.frak.id" : "sdk-dev.frak.id";
}

export function sdkPointerJsDelivrTag(stage: PointerStage): string {
    return stage === "prod" ? "latest" : "beta";
}

/**
 * The one-time seed shim, live only until the first release upload
 * overwrites it (see `ignoreChanges` on the seed object in `sdk-pointer.ts`).
 */
export function sdkPointerSeedContent(stage: PointerStage): string {
    const tag = sdkPointerJsDelivrTag(stage);
    return `import("https://cdn.jsdelivr.net/npm/@frak-labs/components@${tag}/cdn/loader.js");\n`;
}
