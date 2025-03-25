import { CborDecoder, CborEncoder } from "@jsonjoy.com/json-pack/lib/cbor";

/**
 * Encode the given data to a Uint8Array
 * @param data The data to encode
 * @returns The encoded data
 */
export function encodeJson<T>(data: T): Uint8Array {
    const encoder = new CborEncoder();
    const encoded = encoder.encode(data);
    return encoded;
}

/**
 * Decode the given data from a Uint8Array
 * @param data The data to decode
 * @returns The decoded data
 */
export function decodeJson<T>(data: Uint8Array): T {
    const decoder = new CborDecoder();
    const decoded = decoder.decode(data);
    return decoded as T;
}
