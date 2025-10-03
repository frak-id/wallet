import type { RpcSchema } from "../rpc-schema";
import type { RpcMiddleware } from "../types";
import {
    type CompressedData,
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../utils/compression";

/**
 * Client-side compression middleware
 *
 * Compresses outgoing requests and decompresses incoming responses.
 * Always uses the format: {method: string, params: unknown}
 *
 * @example Client side
 * ```ts
 * const client = createRpcClient({
 *   transport: iframe.contentWindow,
 *   targetOrigin: 'https://wallet.frak.id',
 *   middleware: [createClientCompressionMiddleware()]
 * })
 * ```
 */
export const createClientCompressionMiddleware = <
    TSchema extends RpcSchema,
    TContext,
>(): RpcMiddleware<TSchema, TContext> => ({
    onRequest: (message, context) => {
        // Check if data is already compressed
        const isCompressed =
            message.data instanceof Uint8Array ||
            ArrayBuffer.isView(message.data);

        if (isCompressed) return context;

        try {
            // Compress the data: {method, params} → Uint8Array
            message.data = hashAndCompressData(message.data);
        } catch (error) {
            console.error(
                "[Compression Middleware] Failed to compress request",
                error
            );
        }

        return context;
    },

    onResponse: (_message, response, _context) => {
        if (response.error) {
            return response;
        }

        // Check if result is compressed
        const isCompressed =
            response.result instanceof Uint8Array ||
            ArrayBuffer.isView(response.result);

        if (!isCompressed) return response;

        try {
            // Decompress the response: Uint8Array → original data
            const decompressed = decompressDataAndCheckHash(
                response.result as CompressedData
            );
            const { validationHash: _, ...cleanData } = decompressed;

            // Extract just the result from {method, result}
            if (
                typeof cleanData === "object" &&
                cleanData !== null &&
                "result" in cleanData
            ) {
                response.result = cleanData.result;
            } else {
                response.result = cleanData;
            }
        } catch (error) {
            console.error(
                "[Compression Middleware] Failed to decompress response",
                error
            );
        }

        return response;
    },
});

/**
 * Listener-side compression middleware
 *
 * Decompresses incoming requests and compresses outgoing responses.
 * Always uses the format: {method: string, params: unknown}
 *
 * @example Listener side
 * ```ts
 * const listener = createRpcListener({
 *   transport: window,
 *   allowedOrigins: ['https://example.com'],
 *   middleware: [createListenerCompressionMiddleware()]
 * })
 * ```
 */
export const createListenerCompressionMiddleware = <
    TSchema extends RpcSchema,
    TContext,
>(): RpcMiddleware<TSchema, TContext> => ({
    onRequest: (message, context) => {
        // Check if data is compressed
        const isCompressed =
            message.data instanceof Uint8Array ||
            ArrayBuffer.isView(message.data);

        // If data not compressed, early exit
        if (!isCompressed) return context;

        try {
            // Decompress the request: Uint8Array → {method, params}
            const decompressed = decompressDataAndCheckHash(
                message.data as CompressedData
            );
            const { validationHash: _, ...cleanData } = decompressed;

            // Extract just the params from {method, params}
            if (typeof cleanData === "object" && "params" in cleanData) {
                message.data = cleanData.params;
            } else {
                message.data = cleanData;
            }
        } catch (error) {
            console.error(
                "[Compression Middleware] Failed to decompress request",
                error
            );
            throw error;
        }

        return context;
    },

    onResponse: (message, response, _context) => {
        if (response.error) {
            return response;
        }

        // Check if result is already compressed
        const isCompressed =
            response.result instanceof Uint8Array ||
            ArrayBuffer.isView(response.result);

        if (isCompressed) return response;

        try {
            // Compress the response: params → {method, params} → Uint8Array
            const dataToCompress = {
                method: message.topic,
                result: response.result,
            };
            response.result = hashAndCompressData(dataToCompress);
        } catch (error) {
            console.error(
                "[Compression Middleware] Failed to compress response",
                error
            );
        }

        return response;
    },
});
