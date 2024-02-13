import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../compression";
import type {
    EventsFormat,
    FrakWalletSdkConfig,
    GetUnlockStatusParam,
    GetUnlockStatusResponse,
} from "../types";

/**
 * Key accessor for the params and the response
 * @param params
 */
const unlockParamKeyAccessor = (params: GetUnlockStatusParam) => [
    params.articleId,
    params.contentId,
];
const unlockResponseKeyAccessor = (response: GetUnlockStatusResponse) => [
    response.key,
    response.status,
];

/**
 * Helper for the get unlock request params
 * @param config
 * @param params
 */
export async function getUnlockStatusEvent(
    config: FrakWalletSdkConfig,
    params: Omit<GetUnlockStatusParam, "contentId">
): Promise<EventsFormat> {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        { ...params, contentId: config.contentId },
        unlockParamKeyAccessor
    );
    return {
        topic: "unlock-status-param",
        data: {
            compressed,
            compressedHash: compressedHash,
        },
    };
}

/**
 * Helper to parse the unlock status response
 */
export async function parseUnlockStatusEventResponse(
    event: EventsFormat
): Promise<GetUnlockStatusResponse> {
    return decompressDataAndCheckHash(event.data, unlockResponseKeyAccessor);
}

/**
 * Helper for the get unlock request params
 *   - TODO: This should be moved to the wallet app directly, no needed for external usage
 */
export async function parseUnlockStatusEvent(
    event: EventsFormat
): Promise<GetUnlockStatusParam> {
    return decompressDataAndCheckHash(event.data, unlockParamKeyAccessor);
}

/**
 * Helper to parse the unlock status response
 *   - TODO: This should be moved to the wallet app directly, no needed for external usage
 */
export async function getUnlockStatusResponseEvent(
    response: GetUnlockStatusResponse
): Promise<EventsFormat> {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        response,
        unlockResponseKeyAccessor
    );
    return {
        topic: "unlock-status-response",
        data: {
            compressed,
            compressedHash: compressedHash,
        },
    };
}
