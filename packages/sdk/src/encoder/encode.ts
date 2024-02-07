import { compressToBase64 } from "async-lz-string";
import { keccak256, toHex } from "viem";
import type { EventsParam } from "../types/communication/Events.ts";

/*
 * TODO: This would be for post POC security
 *  The idea is to have:
 *  - An outer hash of the params to prevent on the fly modification (with a secret key inside provided to the partner)
 *  - An inner hash of the compressed string to prevent interception (in the case the secret key has leaked an someone tamper the request and regen an hash)
 *  - Asymetrical signature?
 */

/**
 * Encode the given params to a compressed string with a few hash to prevent on the fly modification / interception
 * @param params The params to encode
 */
export async function encodeParams(params: EventsParam) {
    // Create a hash of the main params
    const validationHash = keccak256(
        toHex(`${params.value.articleId}_${params.value.contentId}`)
    );

    // Stringify and compress it (with the hash added inside)
    const compressed = await compressToBase64(
        JSON.stringify({
            ...params,
            validationHash,
        })
    );

    // Digest the compressed string
    const encodedHash = keccak256(toHex(compressed));

    return {
        encoded: compressed,
        encodedHash,
    };
}
