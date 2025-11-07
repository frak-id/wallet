import type { CompressedSsoData, FullSsoParams } from "@frak-labs/core-sdk";

export function compressedSsoToParams(
    compressed: CompressedSsoData
): FullSsoParams {
    return {
        redirectUrl: compressed.r,
        directExit: compressed.d,
        lang: compressed.l,
        productId: compressed.p,
        metadata: {
            name: compressed.m?.n,
            css: compressed.m?.css,
            logoUrl: compressed.m?.l,
            homepageLink: compressed.m?.h,
        },
    };
}
