import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../compression";
import type {
    CompressedData,
    FrakWalletSdkConfig,
    UnlockRequestParams,
    UnlockRequestResponse,
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
const unlockResponseKeyAccessor = (response: UnlockRequestResponse) => [
    response.key,
    response.status,
    response.user,
];

/**
 * Helper for the unlock request params
 * @param config
 * @param params
 */
export const getUnlockRequestUrl = async (
    config: FrakWalletSdkConfig,
    params: UnlockRequestParams
) => {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        params,
        unlockParamKeyAccessor
    );
    // Then build the URL
    return `${config.walletUrl}/paywall?params=${encodeURIComponent(
        compressed
    )}&hash=${compressedHash}`;
};
export const parseUnlockRequest = async ({
    params,
    hash,
}: { params: string; hash: string }) => {
    // Ensure we got the required params first
    if (!(params && hash)) {
        throw new Error("Missing compressed data");
    }
    // Decompress the data
    return decompressDataAndCheckHash<UnlockRequestParams>(
        { compressed: params, compressedHash: hash },
        unlockParamKeyAccessor
    );
};

/**
 * Helper for the unlock request response
 * @param response
 */
export const prepareUnlockRequestResponse = async (
    response: UnlockRequestResponse
) => hashAndCompressData(response, unlockResponseKeyAccessor);
export const parseUnlockRequestResponse = async (data: CompressedData) =>
    decompressDataAndCheckHash<UnlockRequestResponse>(
        data,
        unlockResponseKeyAccessor
    );
