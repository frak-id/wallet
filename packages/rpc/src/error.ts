import type { RpcError } from "./types";

/**
 * RPC error codes
 * Follows JSON-RPC 2.0 specification with Frak-specific extensions
 */
export const RpcErrorCodes = {
    // Standard JSON-RPC 2.0 errors
    parseError: -32700,
    invalidRequest: -32600,
    methodNotFound: -32601,
    invalidParams: -32602,
    internalError: -32603,
    serverError: -32000,

    // Frak specific errors (from -32001 to -32099)
    clientNotConnected: -32001,
    configError: -32002,
    corruptedResponse: -32003,
    clientAborted: -32004,
    walletNotConnected: -32005,
    serverErrorForInteractionDelegation: -32006,
    userRejected: -32007,
} as const;

/**
 * Generic Frak RPC error
 * @ignore
 */
export class FrakRpcError<T = undefined> extends Error {
    constructor(
        public code: number,
        message: string,
        public data?: T
    ) {
        super(message);
    }

    toJSON(): RpcError {
        return {
            code: this.code,
            message: this.message,
            data: this.data,
        };
    }
}

/** @ignore */
export class MethodNotFoundError extends FrakRpcError<{ method: string }> {
    constructor(message: string, method: string) {
        super(RpcErrorCodes.methodNotFound, message, { method });
    }
}

/** @ignore */
export class InternalError extends FrakRpcError {
    constructor(message: string) {
        super(RpcErrorCodes.internalError, message);
    }
}

/** @ignore */
export class ClientNotFound extends FrakRpcError {
    constructor() {
        super(RpcErrorCodes.clientNotConnected, "Client not found");
    }
}
