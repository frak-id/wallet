import {
    compressJson,
    decompressDataAndCheckHash,
    decompressJson,
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
    const compressedParams = await hashAndCompressData(
        params,
        unlockParamKeyAccessor
    );
    // Compress yet again the params into a single string
    const compressedParamsString = encodeURIComponent(
        await compressJson(compressedParams)
    );
    // Then build the URL
    return `${config.walletUrl}/paywall?compressedParams=${compressedParamsString}`;
};
export const parseUnlockRequest = async (compressedDataParam: string) => {
    // Decode it
    const compressedParams = await decompressJson<CompressedData>(
        decodeURIComponent(compressedDataParam)
    );
    if (!compressedParams) {
        throw new Error("Invalid compressed data");
    }
    // Decompress the data
    return decompressDataAndCheckHash<UnlockRequestParams>(
        compressedParams,
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
