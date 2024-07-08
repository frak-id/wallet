import type {
    NexusWalletSdkConfig,
    StartArticleUnlockParams,
    StartArticleUnlockReturnType,
} from "../types";
import { decompressDataAndCheckHash, hashAndCompressData } from "../utils";

export type GetStartUnlockUrlParams = StartArticleUnlockParams;

/**
 * Function used to build the unlock URL for a given article
 * @param config
 * @param params
 */
export async function getStartArticleUnlockUrl(
    config: NexusWalletSdkConfig,
    params: GetStartUnlockUrlParams
) {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData({
        method: "frak_startArticleUnlock",
        params: params,
    });

    // Then build the URL
    const outputUrl = new URL(config.walletUrl);
    outputUrl.pathname = "/paywall";
    outputUrl.searchParams.set("params", encodeURIComponent(compressed));
    outputUrl.searchParams.set("hash", encodeURIComponent(compressedHash));
    return outputUrl.toString();
}

/**
 * Function used to decode the response from the start unlock request (return typed passed as query param)
 */
export async function decodeStartUnlockReturn({
    result,
    hash,
}: { result: string; hash: string }) {
    // Decompress the data
    return decompressDataAndCheckHash<StartArticleUnlockReturnType>({
        compressed: decodeURIComponent(result),
        compressedHash: decodeURIComponent(hash),
    });
}
