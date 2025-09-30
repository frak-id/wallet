import type { RpcSchema } from "../rpc-schema";
import type { RpcMiddleware } from "../types";

/**
 * Compression middleware configuration
 */
export type CompressionMiddlewareConfig = {
    /**
     * Minimum size in bytes to apply compression
     * @default 1024 (1KB)
     */
    threshold?: number;
    /**
     * Compression algorithm to use
     * @default "gzip"
     */
    algorithm?: "gzip" | "deflate";
};

/**
 * Checks if data is compressed (base64 encoded)
 */
function isCompressed(data: unknown): boolean {
    if (typeof data !== "string") return false;
    // Simple heuristic: compressed data is usually base64 encoded and longer
    return /^[A-Za-z0-9+/=]+$/.test(data) && data.length > 100;
}

/**
 * Decompresses base64-encoded compressed data
 * Uses browser's native CompressionStream API
 */
async function decompress(
    compressedData: string,
    algorithm: "gzip" | "deflate"
): Promise<unknown> {
    try {
        // Decode base64 to Uint8Array
        const binaryString = atob(compressedData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Decompress using DecompressionStream
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(bytes);
                controller.close();
            },
        });

        const decompressedStream = stream.pipeThrough(
            new DecompressionStream(algorithm)
        );
        const reader = decompressedStream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
        }

        // Combine chunks and decode as JSON
        const allChunks = new Uint8Array(
            chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        );
        let offset = 0;
        for (const chunk of chunks) {
            allChunks.set(chunk, offset);
            offset += chunk.length;
        }

        const jsonString = new TextDecoder().decode(allChunks);
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("[Compression Middleware] Decompression failed:", error);
        // Return original data if decompression fails
        return compressedData;
    }
}

/**
 * Compresses data and returns base64-encoded string
 * Uses browser's native CompressionStream API
 */
async function compress(
    data: unknown,
    algorithm: "gzip" | "deflate"
): Promise<string> {
    try {
        // Convert to JSON string and then to Uint8Array
        const jsonString = JSON.stringify(data);
        const bytes = new TextEncoder().encode(jsonString);

        // Compress using CompressionStream
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(bytes);
                controller.close();
            },
        });

        const compressedStream = stream.pipeThrough(
            new CompressionStream(algorithm)
        );
        const reader = compressedStream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
        }

        // Combine chunks and encode as base64
        const allChunks = new Uint8Array(
            chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        );
        let offset = 0;
        for (const chunk of chunks) {
            allChunks.set(chunk, offset);
            offset += chunk.length;
        }

        // Convert to base64
        let binaryString = "";
        for (let i = 0; i < allChunks.length; i++) {
            binaryString += String.fromCharCode(allChunks[i]);
        }

        return btoa(binaryString);
    } catch (error) {
        console.error("[Compression Middleware] Compression failed:", error);
        // Return original data if compression fails
        return JSON.stringify(data);
    }
}

/**
 * Creates a compression/decompression middleware for RPC messages
 * Handles automatic decompression of incoming requests and compression of responses
 *
 * Note: This middleware should be placed early in the stack to handle
 * compression/decompression before other middleware processes the data
 *
 * @param config - Compression configuration
 * @returns Compression middleware instance
 *
 * @example
 * ```ts
 * const listener = createRpcListener({
 *   transport: window,
 *   allowedOrigins: ['https://example.com'],
 *   middleware: [
 *     createCompressionMiddleware({ threshold: 2048, algorithm: 'gzip' }),
 *     loggingMiddleware
 *   ]
 * })
 * ```
 */
export function createCompressionMiddleware<TSchema extends RpcSchema>(
    config: CompressionMiddlewareConfig = {}
): RpcMiddleware<TSchema> {
    const { threshold = 1024, algorithm = "gzip" } = config;

    return {
        onRequest: async (message, context) => {
            // Check if data is compressed and decompress it
            if (isCompressed(message.data)) {
                const decompressed = await decompress(
                    message.data as string,
                    algorithm
                );
                // Mutate message.data with decompressed data
                // This allows subsequent middleware and handlers to work with decompressed data
                (message as { data: unknown }).data = decompressed;
            }

            return context;
        },

        onResponse: async (_message, response) => {
            // Only compress responses with results (not errors)
            if (!response.result) {
                return response;
            }

            // Calculate approximate size
            const jsonSize = JSON.stringify(response.result).length;

            // Only compress if above threshold
            if (jsonSize < threshold) {
                return response;
            }

            // Compress the result
            const compressed = await compress(response.result, algorithm);

            return {
                result: compressed,
            };
        },
    };
}
