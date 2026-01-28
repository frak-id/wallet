import type { CompressedSsoData, FullSsoParams } from "@frak-labs/core-sdk";

export function compressedSsoToParams(
    compressed: CompressedSsoData
): FullSsoParams {
    return {
        redirectUrl: compressed.r,
        directExit: compressed.d,
        lang: compressed.l,
        merchantId: compressed.m,
        metadata: {
            name: compressed.md?.n,
            css: compressed.md?.css,
            logoUrl: compressed.md?.l,
            homepageLink: compressed.md?.h,
        },
    };
}
