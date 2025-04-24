import { CborEncoder } from "@jsonjoy.com/json-pack/lib/cbor/index.js";
import { sha256 } from "viem";
import type {
    CompressedData,
    HashProtectedData,
} from "../../types/compression";
import { base64urlEncode } from "./b64";

const encoder = new CborEncoder();

/**
 * Compress the given params, and add hash protection to (rapidly) prevent interception modification
 * @param data The params to encode
 * @ignore
 */
export function hashAndCompressData<T>(data: T): CompressedData {
    // Create a hash of the main params
    const hashProtectedData: HashProtectedData<T> = {
        ...data,
        validationHash: hashJson(data),
    };

    // Encode the full data
    return encoder.encode(hashProtectedData);
}

/**
 * Compress json data
 * @param data
 * @ignore
 */
export function compressJson(data: unknown): Uint8Array {
    return encoder.encode(data);
}

/**
 * Compress json data
 * @param data
 * @ignore
 */
export function compressJsonToB64(data: unknown): string {
    return base64urlEncode(compressJson(data));
}

/**
 * Compress json data
 * @param data
 * @ignore
 */
export function hashJson(data: unknown): string {
    return sha256(encoder.encode(data));
}
