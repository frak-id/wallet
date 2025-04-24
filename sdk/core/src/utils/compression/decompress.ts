import { CborDecoder } from "@jsonjoy.com/json-pack/lib/cbor/index.js";
import { FrakRpcError, RpcErrorCodes } from "../../types";
import type {
    CompressedData,
    HashProtectedData,
} from "../../types/compression";
import { base64urlDecode } from "./b64";
import { hashJson } from "./compress";

const decoder = new CborDecoder();

/**
 * Decompress the given string
 * @param compressedData The params to encode
 * @ignore
 */
export function decompressDataAndCheckHash<T>(
    compressedData: CompressedData
): HashProtectedData<T> {
    // Ensure we got the required params first
    if (!compressedData.length) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Missing compressed data"
        );
    }

    // Decompress and parse the data
    const parsedData = decompressJson<HashProtectedData<T>>(compressedData);
    if (!parsedData) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Invalid compressed data"
        );
    }

    // Ensure the validation hash is present
    if (!parsedData?.validationHash) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Missing validation hash"
        );
    }

    // And check the validation hash
    const { validationHash: _, ...rawResultData } = parsedData;
    const expectedValidationHash = hashJson(rawResultData);
    if (expectedValidationHash !== parsedData.validationHash) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Invalid data validation hash"
        );
    }

    // If everything is fine, return the parsed data
    return parsedData;
}
/**
 * Decompress json data
 * @param data
 * @ignore
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
 * Decompress json data
 * @param data
 * @ignore
 */
export function decompressJsonFromB64<T>(data: string): T | null {
    return decompressJson(base64urlDecode(data));
}
