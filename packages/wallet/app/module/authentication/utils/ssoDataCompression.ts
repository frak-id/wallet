import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import type { OpenSsoParamsType } from "@frak-labs/core-sdk";
import type { Hex } from "viem";

/**
 * full sso params
 */
export type FullSsoParams = Omit<OpenSsoParamsType, "metadata"> & {
    metadata: AppSpecificSsoMetadata;
    productId: Hex;
};

/**
 * Map full sso params to compressed sso params
 * @param params
 */
export function ssoParamsToCompressed(params: FullSsoParams) {
    return {
        r: params.redirectUrl,
        d: params.directExit,
        l: params.lang,
        p: params.productId,
        m: {
            n: params.metadata.name,
            css: params.metadata.css,
            l: params.metadata.logoUrl,
            h: params.metadata.homepageLink,
        },
    };
}

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

/**
 * Type of compressed the sso data
 */
export type CompressedSsoData = {
    // Potential id from backend
    id?: Hex;
    // redirect url
    r?: string;
    // direct exit
    d?: boolean;
    // language
    l?: "en" | "fr";
    // product id
    p: Hex;
    // metadata
    m: {
        // product name
        n: string;
        // custom css
        css?: string;
        // logo
        l?: string;
        // home page link
        h?: string;
    };
};
