import { decompressFromBase64 } from "async-lz-string";
import { sha256 } from "js-sha256";
import type { CompressedData, HashProtectedData } from "../types";

/**
 * Decompress the given string
 * @param compressedData The params to encode
 * @param keyAccessor The key accessor used to query the keys used for the validation hash
 */
export async function decompressDataAndCheckHash<T>(
    compressedData: CompressedData,
    keyAccessor: (value: T) => string[]
): Promise<HashProtectedData<T>> {
    // Ensure we got the required params first
    if (!(compressedData?.compressed && compressedData?.compressedHash)) {
        throw new Error("Missing compressed data");
    }

    // Decompress and parse the data
    const parsedData = await decompressJson<HashProtectedData<T>>(
        compressedData.compressed
    );
    if (!parsedData) {
        throw new Error(`Invalid compressed data: ${parsedData}`);
    }

    // Ensure the validation hash is present
    if (!parsedData?.validationHash) {
        throw new Error("Missing validation hash");
    }

    //  Then check the global compressed hash
    const expectedCompressedHash = sha256(compressedData.compressed);
    if (expectedCompressedHash !== compressedData.compressedHash) {
        throw new Error("Invalid compressed hash");
    }

    // And check the validation hash
    const keys = keyAccessor(parsedData);
    const expectedValidationHash = sha256(keys.join("_"));
    if (expectedValidationHash !== parsedData.validationHash) {
        throw new Error("Invalid data validation hash");
    }

    // If everything is fine, return the parsed data
    return parsedData;
}
/**
 * Decompress json data
 * @param data
 */
export async function decompressJson<T>(data: string): Promise<T | null> {
    const decompressed = await decompressFromBase64(data);
    try {
        return JSON.parse(decompressed) as T;
    } catch (e) {
        console.error("Invalid compressed data", e);
        return null;
    }
}
