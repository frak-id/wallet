import { FrakRpcError, RpcErrorCodes } from "../../types";

/**
 * Decompress json data
 * @param data
 * @ignore
 */
export function decompressJson<T>(data: string): T | null {
    // Ensure we got the required params first
    if (!data) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Missing compressed data"
        );
    }

    const decompressed = decodeURIComponent(atob(data));

    if (!decompressed) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Invalid compressed data"
        );
    }

    try {
        return JSON.parse(decompressed) as T;
    } catch (e) {
        console.error("Invalid compressed data", { e, decompressed });
        return null;
    }
}
