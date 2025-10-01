import type { RpcResponse } from "@frak-labs/rpc";
import {
    type CompressedData,
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "@frak-labs/rpc/utils/compression";

/**
 * Compression middleware for wallet RPC communication
 *
 * Handles automatic decompression of incoming requests and compression of outgoing responses.
 * Uses CBOR encoding with hash validation for data integrity.
 *
 * Performance considerations:
 * - Compression reduces network payload size significantly for large objects
 * - Hash validation prevents tampering with RPC messages
 * - CBOR is more compact than JSON and faster to parse
 *
 * This middleware should be placed FIRST in the middleware stack to ensure
 * all subsequent middleware and handlers work with decompressed data.
 *
 * Moved from lifecycleHandlers.ts to centralize compression logic in middleware.
 *
 * @example
 * ```ts
 * const listener = createRpcListener<IFrameRpcSchema>({
 *   transport: window,
 *   allowedOrigins: '*',
 *   middleware: [
 *     compressionMiddleware,  // First - decompress incoming
 *     loggingMiddleware,      // Second - log decompressed data
 *     walletContextMiddleware // Third - augment context
 *   ]
 * })
 * ```
 */
export const compressionMiddleware = {
    /**
     * Decompress incoming request data
     * Validates hash to ensure data integrity
     */
    onRequest: <TContext>(message: unknown, context: TContext): TContext => {
        const msg = message as { data: unknown };

        // Check if data is compressed (Uint8Array from CBOR encoding)
        if (msg.data instanceof Uint8Array || ArrayBuffer.isView(msg.data)) {
            try {
                // Decompress and validate hash
                const decompressed = decompressDataAndCheckHash(
                    msg.data as CompressedData
                );

                // Remove the validation hash from the decompressed data
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { validationHash, ...cleanData } = decompressed;

                // Mutate message.data with decompressed data
                // This allows subsequent middleware and handlers to work with clean data
                msg.data = cleanData;
            } catch (error) {
                console.error("Failed to decompress request data", {
                    error,
                    topic: (msg as { topic?: string }).topic,
                });
                // Re-throw to reject the request
                throw error;
            }
        }

        return context;
    },

    /**
     * Compress outgoing response data
     * Adds hash for validation on client side
     */
    onResponse: (_message: unknown, response: RpcResponse): RpcResponse => {
        // Only compress successful responses (not errors)
        if (response.error) {
            return response;
        }

        try {
            // Hash and compress the result
            const compressed = hashAndCompressData(response.result);

            // Return compressed response
            const compressedResponse: RpcResponse = {
                result: compressed,
            };

            return compressedResponse;
        } catch (error) {
            console.error("Failed to compress response data", {
                error,
            });
            // Return original response on compression failure
            return response;
        }
    },
} as const;
