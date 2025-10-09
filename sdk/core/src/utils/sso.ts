import type { Hex } from "viem";
import type { PrepareSsoParamsType, SsoMetadata } from "../types";
import { compressJsonToB64 } from "./compression/compress";

export type AppSpecificSsoMetadata = SsoMetadata & {
    name: string;
    css?: string;
};

/**
 * The full SSO params that will be used for compression
 */
export type FullSsoParams = Omit<PrepareSsoParamsType, "metadata"> & {
    metadata: AppSpecificSsoMetadata;
    productId: Hex;
};

/**
 * Generate SSO URL with compressed parameters
 * This mirrors the wallet's getOpenSsoLink() function
 *
 * @param walletUrl - Base wallet URL (e.g., "https://wallet.frak.id")
 * @param params - SSO parameters
 * @param productId - Product identifier
 * @param name - Application name
 * @param css - Optional custom CSS
 * @returns Complete SSO URL ready to open in popup or redirect
 *
 * @example
 * ```ts
 * const ssoUrl = generateSsoUrl(
 *   "https://wallet.frak.id",
 *   { metadata: { logoUrl: "..." }, directExit: true },
 *   "0x123...",
 *   "My App"
 * );
 * // Returns: https://wallet.frak.id/sso?p=<compressed_base64>
 * ```
 */
export function generateSsoUrl(
    walletUrl: string,
    params: PrepareSsoParamsType,
    productId: Hex,
    name: string,
    css?: string
): string {
    // Build full params with app-specific metadata
    const fullParams: FullSsoParams = {
        redirectUrl: params.redirectUrl,
        directExit: params.directExit,
        lang: params.lang,
        productId,
        metadata: {
            name,
            css,
            logoUrl: params.metadata?.logoUrl,
            homepageLink: params.metadata?.homepageLink,
        },
    };

    // Compress params to minimal format
    const compressedParam = ssoParamsToCompressed(fullParams);

    // Encode to base64url
    const compressedString = compressJsonToB64(compressedParam);

    // Build URL matching wallet's expected format: /sso?p=<compressed>
    const ssoUrl = new URL(walletUrl);
    ssoUrl.pathname = "/sso";
    ssoUrl.searchParams.set("p", compressedString);

    return ssoUrl.toString();
}

/**
 * Map full sso params to compressed sso params
 * @param params
 */
function ssoParamsToCompressed(params: FullSsoParams) {
    return {
        r: params.redirectUrl,
        d: params.directExit,
        l: params.lang,
        p: params.productId,
        m: {
            n: params.metadata?.name,
            css: params.metadata?.css,
            l: params.metadata?.logoUrl,
            h: params.metadata?.homepageLink,
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
