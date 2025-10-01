import {
    CborDecoder,
    CborEncoder,
} from "@jsonjoy.com/json-pack/lib/cbor/index.js";
import { sha256 } from "viem";

/**
 * The received encoded data from a client
 * -> The encoded should contain a HashProtectedData once decoded
 */
export type CompressedData = Uint8Array;

/**
 * The encoded data to send to a client / received by a client
 */
export type HashProtectedData<DataType> = Readonly<
    DataType & {
        validationHash: string;
    }
>;

/**
 * CBOR encoder/decoder instances
 * Created once and reused for performance
 */
const encoder = new CborEncoder();
const decoder = new CborDecoder();

/**
 * Compress the given data with hash protection to prevent tampering
 *
 * Performance considerations:
 * - CBOR encoding is more compact than JSON and faster to parse
 * - Hash validation prevents man-in-the-middle modifications
 * - Single-pass encoding minimizes allocations
 *
 * @param data - The data to compress and protect
 * @returns Compressed CBOR-encoded data with validation hash
 *
 * @example
 * ```ts
 * const compressed = hashAndCompressData({ foo: 'bar', baz: 123 })
 * // Returns Uint8Array with CBOR-encoded data + validation hash
 * ```
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
 * Decompress and validate hash-protected data
 *
 * Security:
 * - Validates hash to ensure data integrity
 * - Throws RpcError if hash validation fails
 * - Prevents corrupted or tampered messages from processing
 *
 * @param compressedData - The compressed data to decompress
 * @returns The decompressed data with validation hash
 * @throws {Error} If decompression fails or hash validation fails
 *
 * @example
 * ```ts
 * const decompressed = decompressDataAndCheckHash(compressedData)
 * // Returns { foo: 'bar', baz: 123, validationHash: '0x...' }
 * ```
 */
export function decompressDataAndCheckHash<T>(
    compressedData: CompressedData
): HashProtectedData<T> {
    // Ensure we got the required params first
    if (!compressedData.length) {
        throw new Error("Missing compressed data");
    }

    // Decompress and parse the data
    const parsedData = decompressJson<HashProtectedData<T>>(compressedData);
    if (!parsedData) {
        throw new Error("Invalid compressed data");
    }

    // Ensure the validation hash is present
    if (!parsedData?.validationHash) {
        throw new Error("Missing validation hash");
    }

    // And check the validation hash
    const { validationHash: _, ...rawResultData } = parsedData;
    const expectedValidationHash = hashJson(rawResultData);
    if (expectedValidationHash !== parsedData.validationHash) {
        throw new Error("Invalid data validation hash");
    }

    // If everything is fine, return the parsed data
    return parsedData;
}

/**
 * Compress JSON data using CBOR encoding
 *
 * @param data - The data to compress
 * @returns CBOR-encoded data
 *
 * @example
 * ```ts
 * const compressed = compressJson({ foo: 'bar' })
 * // Returns Uint8Array with CBOR-encoded data
 * ```
 */
export function compressJson(data: unknown): Uint8Array {
    return encoder.encode(data);
}

/**
 * Decompress CBOR-encoded data
 *
 * @param data - The compressed data
 * @returns Decompressed data or null if decompression fails
 *
 * @example
 * ```ts
 * const decompressed = decompressJson<MyType>(compressedData)
 * if (decompressed) {
 *   // Use decompressed data
 * }
 * ```
 */
export function decompressJson<T>(data: Uint8Array): T | null {
    try {
        return decoder.decode(data) as T;
    } catch (e) {
        console.error("Invalid compressed data", { e, data });
        return null;
    }
}

/**
 * Create a hash of JSON data
 * Used internally for hash validation
 *
 * @param data - The data to hash
 * @returns SHA256 hash of the CBOR-encoded data
 */
function hashJson(data: unknown): string {
    return sha256(encoder.encode(data));
}
