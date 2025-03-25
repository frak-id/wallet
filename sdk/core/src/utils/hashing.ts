import { sha256 } from "js-sha256";
import { FrakRpcError, RpcErrorCodes } from "../types";
import type { HashProtectedData } from "../types/compression";

/**
 * Hash the given data
 * @param data The data to hash
 * @ignore
 */
export function hashData<T>(data: T): HashProtectedData<T> {
    // Create a hash of the main params
    const validationHash = sha256(JSON.stringify(data));
    const hashProtectedData: HashProtectedData<T> = {
        ...data,
        validationHash,
    };
    return hashProtectedData;
}

/**
 * Check the hash of the given data
 * @param data The data to check
 * @ignore
 */
export function checkHash<T>(data: HashProtectedData<T>): HashProtectedData<T> {
    if (!data) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Invalid hash protected data"
        );
    }

    // Ensure the validation hash is present
    if (!data?.validationHash) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Missing validation hash"
        );
    }

    // And check the validation hash
    const { validationHash: _, ...rawResultData } = data;
    const expectedValidationHash = sha256(JSON.stringify(rawResultData));
    if (expectedValidationHash !== data.validationHash) {
        throw new FrakRpcError(
            RpcErrorCodes.corruptedResponse,
            "Invalid data validation hash"
        );
    }

    // If everything is fine, return the parsed data
    return data;
}
