import { compressToBase64 } from "async-lz-string";
import { sha256 } from "js-sha256";
import type {
    CompressedData,
    HashProtectedData,
} from "../../types/compression";

/*
 * After investigation, here is the result:
 *   - Single level compression -> Ok (save approx 20% on the overral size, we can do better with the hash I think)
 *   - Second level (compressing json containing a compressed string) -> useless, increase by approx 5%
 *
 * HMAC could be a good way to add a layer of protection (with a key per provider, using like the apiKey or smth like that?)
 */

/**
 * Compress the given params, and add hash protection to (rapidly) prevent interception modification
 * @param data The params to encode
 */
export async function hashAndCompressData<T>(data: T): Promise<CompressedData> {
    // Create a hash of the main params
    const validationHash = sha256(JSON.stringify(data));
    const hashProtectedData: HashProtectedData<T> = {
        ...data,
        validationHash,
    };

    // Stringify and compress it (with the hash added inside)
    const compressed = await compressJson(hashProtectedData);

    // Digest the compressed string
    const compressedHash = sha256(compressed);

    return {
        compressed,
        compressedHash,
    };
}

/**
 * Compress json data
 * @param data
 */
export async function compressJson(data: unknown): Promise<string> {
    return compressToBase64(JSON.stringify(data));
}
