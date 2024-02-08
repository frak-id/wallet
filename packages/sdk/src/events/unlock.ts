import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../compression";
import type {
    FrakWalletSdkConfig,
    UnlockRequestParams,
    UnlockRequestResult,
} from "../types";

/**
 * Key accessor for the params and the response
 * @param params
 */
const unlockParamKeyAccessor = (params: UnlockRequestParams) => [
    params.articleId,
    params.contentId,
    params.price.index.toString(),
];
const unlockResponseKeyAccessor = (response: UnlockRequestResult) => [
    response.key,
    response.status,
    response.user,
];

/**
 * Helper for the unlock request params
 * @param config
 * @param params
 */
export async function getUnlockRequestUrl(
    config: FrakWalletSdkConfig,
    params: Omit<UnlockRequestParams, "contentId" | "contentTitle">
) {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        {
            ...params,
            contentId: config.contentId,
            contentTitle: config.contentTitle,
        },
        unlockParamKeyAccessor
    );
    // Then build the URL
    const outputUrl = new URL(config.walletUrl);
    outputUrl.pathname = "/paywall";
    outputUrl.searchParams.set("params", encodeURIComponent(compressed));
    outputUrl.searchParams.set("hash", encodeURIComponent(compressedHash));
    return outputUrl.toString();
}

/**
 * Parse the unlock request response
 * @param data
 */
export async function parseUnlockRequestResult({
    result,
    hash,
}: { result: string; hash: string }) {
    // Ensure we got the required params first
    if (!(result && hash)) {
        throw new Error("Missing compressed data");
    }
    // Decompress the data
    return decompressDataAndCheckHash<UnlockRequestResult>(
        {
            compressed: decodeURIComponent(result),
            compressedHash: decodeURIComponent(hash),
        },
        unlockResponseKeyAccessor
    );
}

/**
 * Parse an unlock request
 *   - TODO: This should be moved to the wallet app directly, no needed for external usage
 * @param params
 * @param hash
 */
export async function parseUnlockRequestParams({
    params,
    hash,
}: { params: string; hash: string }) {
    // Ensure we got the required params first
    if (!(params && hash)) {
        throw new Error("Missing compressed data");
    }
    // Decompress the data
    return decompressDataAndCheckHash<UnlockRequestParams>(
        {
            compressed: decodeURIComponent(params),
            compressedHash: decodeURIComponent(hash),
        },
        unlockParamKeyAccessor
    );
}

/**
 * Build the response for the unlock request
 *   - TODO: This should be moved to the wallet app directly, no needed for external usage
 * @param redirectUrl
 * @param response
 */
export async function prepareUnlockRequestResponse(
    redirectUrl: string,
    response: UnlockRequestResult
) {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        response,
        unlockResponseKeyAccessor
    );
    // Parse the redirect URL provided
    const parsedRedirectUrl = new URL(redirectUrl);
    // Add the params to the URL
    parsedRedirectUrl.searchParams.set(
        "result",
        encodeURIComponent(compressed)
    );
    parsedRedirectUrl.searchParams.set(
        "hash",
        encodeURIComponent(compressedHash)
    );
    // Then build the URL
    return parsedRedirectUrl.toString();
}
