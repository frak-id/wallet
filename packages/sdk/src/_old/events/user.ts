import { keccak256, toHex } from "viem";
import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../compression";
import type {
    DecompressedFormat,
    EventsFormat,
    GetUnlockStatusParam,
    GetUserStatusParam,
    GetUserStatusResponse,
} from "../types";

/**
 * Key accessor for the params and the response
 * @param _params
 */
const userStatusParamKeyAccessor = (_params: GetUserStatusParam) => [
    "user-status-param",
];
const userStatusResponseKeyAccessor = (response: GetUserStatusResponse) => [
    response.key,
];

/**
 * Helper for the get user status request data
 * @param params
 */
export async function getUserStatusEvent(
    params: GetUserStatusParam
): Promise<EventsFormat> {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        params,
        userStatusParamKeyAccessor
    );

    // Generate the id of this exchange
    const id = keccak256(toHex("getUserStatus"));

    return {
        id,
        topic: "user-status-param",
        data: {
            compressed,
            compressedHash: compressedHash,
        },
    };
}

/**
 * Helper to parse the user status response
 */
export async function parseUserStatusEventResponse(
    event: EventsFormat
): Promise<GetUserStatusResponse> {
    return decompressDataAndCheckHash(
        event.data,
        userStatusResponseKeyAccessor
    );
}

/**
 * Helper for the get unlock request params
 *   - TODO: This should be moved to the wallet app directly, no needed for external usage
 */
export async function parseUserStatusEvent(
    event: EventsFormat
): Promise<DecompressedFormat<GetUnlockStatusParam>> {
    const data = await decompressDataAndCheckHash(
        event.data,
        userStatusParamKeyAccessor
    );
    return {
        topic: event.topic,
        id: event.id,
        data,
    };
}

/**
 * Helper to parse the unlock status response
 *   - TODO: This should be moved to the wallet app directly, no needed for external usage
 */
export async function getUserStatusResponseEvent(
    response: GetUserStatusResponse,
    id: string
): Promise<EventsFormat> {
    // Compress our params
    const { compressed, compressedHash } = await hashAndCompressData(
        response,
        userStatusResponseKeyAccessor
    );
    return {
        id,
        topic: "user-status-response",
        data: {
            compressed,
            compressedHash: compressedHash,
        },
    };
}
