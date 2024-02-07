import { compressToBase64 } from "async-lz-string";
import { keccak256, toHex } from "viem";
import type {
    CompressedData,
    HashProtectedData,
} from "../types/communication/Encoded.ts";

/**
 * Compress the given params, and add hash protection to (rapidly) prevent interception modification
 * TODO: A more complexe protection system that hash is needed for prod, asymetrical encryption with per clients keys is the ideal
 * @param data The params to encode
 * @param keyAccessor The method used to access the keys
 */
export async function hashAndCompressData<T>(
    data: T,
    keyAccessor: (value: T) => string[]
): Promise<CompressedData> {
    // Create a hash of the main params
    const keys = keyAccessor(data);
    const validationHash = keccak256(toHex(keys.join("_")));

    const hashProtectedData: HashProtectedData<T> = {
        ...data,
        validationHash,
    };

    // Stringify and compress it (with the hash added inside)
    const compressed = await compressJson(hashProtectedData);

    // Digest the compressed string
    const compressedHash = keccak256(toHex(compressed));

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
