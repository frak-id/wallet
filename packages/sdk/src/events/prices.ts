import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../compression";
import type {
    EventsFormat,
    FrakWalletSdkConfig,
    GetPricesParam,
    GetPricesResponse,
} from "../types";

const getPricesParamsKeyAccessor = (params: GetPricesParam) => [
    params.contentId,
    params.articleId,
];
const getPriceResponseKeyAccessor = (response: GetPricesResponse) => [
    response.length.toString(),
];

/**
 * Helper for the get prices request params
 * @param config
 * @param params
 */
export async function getPricesEvent(
    config: FrakWalletSdkConfig,
    params: Omit<GetPricesParam, "contentId">
): Promise<EventsFormat> {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        { ...params, contentId: config.contentId },
        getPricesParamsKeyAccessor
    );
    return {
        topic: "get-price",
        data: {
            compressed,
            compressedHash: compressedHash,
        },
    };
}

/**
 * Helper to parse the prices response
 */
export async function parseGetPricesEventResponse(
    event: EventsFormat
): Promise<GetPricesResponse> {
    // Decompress the data
    return await decompressDataAndCheckHash(
        event.data,
        getPriceResponseKeyAccessor
    );
}

/**
 * Helper to parse the prices params
 *   - TODO: This should be moved to the wallet app directly, no needed for external usage
 */
export async function parseGetPricesEventData(
    event: EventsFormat
): Promise<GetPricesParam> {
    return decompressDataAndCheckHash(event.data, getPricesParamsKeyAccessor);
}

/**
 * Helper to prepare the prices response
 *   - TODO: This should be moved to the wallet app directly, no needed for external usage
 */
export async function getPricesResponseEvent(
    response: GetPricesResponse
): Promise<EventsFormat> {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        response,
        getPriceResponseKeyAccessor
    );
    return {
        topic: "get-price",
        data: {
            compressed,
            compressedHash: compressedHash,
        },
    };
}
