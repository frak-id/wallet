/**
 * Generic Frak RPC error
 */
export class FrakRpcError<T = undefined> extends Error {
    constructor(
        public code: number,
        message: string,
        public data?: T
    ) {
        super(message);
    }
}

export class MethodNotFoundError extends FrakRpcError<{ method: string }> {
    constructor(message: string, method: string) {
        super(RpcErrorCodes.methodNotFound, message, { method });
    }
}

export class InternalError extends FrakRpcError {
    constructor(message: string) {
        super(RpcErrorCodes.internalError, message);
    }
}

export class ClientNotFound extends FrakRpcError {
    constructor() {
        super(RpcErrorCodes.clientNotConnected, "Client not found");
    }
}

/**
 * All the rpc error codes
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
} as const;
