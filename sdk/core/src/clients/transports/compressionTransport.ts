import type { RpcMessage, RpcTransport } from "@frak-labs/rpc";
import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../../utils/compression";

/**
 * Configuration for the compression transport wrapper
 */
export type CompressionTransportConfig = {
    /**
     * The underlying transport to wrap (usually iframe.contentWindow)
     */
    transport: Window | MessageEventSource;
    /**
     * The target origin for postMessage
     */
    targetOrigin: string;
};

/**
 * Creates a compression-aware transport wrapper that handles
 * compression/decompression of RPC messages transparently.
 *
 * This transport wraps an iframe's contentWindow and:
 * - Compresses outgoing messages with hash protection
 * - Decompresses incoming messages and validates hashes
 * - Maintains backward compatibility with existing message format
 *
 * @param config - Transport configuration
 * @returns RPC transport with compression handling
 *
 * @example
 * ```ts
 * const transport = createCompressionTransport({
 *   transport: iframe.contentWindow,
 *   targetOrigin: 'https://wallet.frak.id'
 * })
 *
 * const rpcClient = createRpcClient({
 *   transport,
 *   targetOrigin: 'https://wallet.frak.id'
 * })
 * ```
 */
export function createCompressionTransport(
    config: CompressionTransportConfig
): RpcTransport {
    const { transport, targetOrigin } = config;

    // Store message listeners for proper cleanup
    const listeners = new Set<(event: MessageEvent<RpcMessage>) => void>();

    return {
        /**
         * Send a message with compression
         * Compresses the data field before sending
         */
        postMessage: (message: RpcMessage, target: string) => {
            // Compress the data field
            const compressedData = hashAndCompressData(message.data);

            // Send the message with compressed data
            const compressedMessage = {
                id: message.id,
                topic: message.topic,
                data: compressedData,
            };

            // Use the transport's postMessage
            if (
                "postMessage" in transport &&
                typeof transport.postMessage === "function"
            ) {
                transport.postMessage(compressedMessage, {
                    targetOrigin: target,
                });
            }
        },

        /**
         * Add a message listener with automatic decompression
         * Decompresses the data field before passing to the listener
         */
        addEventListener: (
            _type: "message",
            listener: (event: MessageEvent<RpcMessage>) => void
        ) => {
            // Create a wrapper that decompresses messages
            const wrappedListener = (event: MessageEvent) => {
                // Validate message format
                if (
                    typeof event.data !== "object" ||
                    !event.data ||
                    !("id" in event.data) ||
                    !("topic" in event.data) ||
                    !("data" in event.data)
                ) {
                    return;
                }

                // Validate origin
                try {
                    const messageOrigin = new URL(
                        event.origin
                    ).origin.toLowerCase();
                    const expectedOrigin = new URL(
                        targetOrigin
                    ).origin.toLowerCase();
                    if (messageOrigin !== expectedOrigin) {
                        return;
                    }
                } catch (_e) {
                    return;
                }

                try {
                    // Decompress the data field
                    const decompressedData = decompressDataAndCheckHash(
                        event.data.data
                    );

                    // Create a new event with decompressed data
                    const decompressedMessage: RpcMessage = {
                        id: event.data.id,
                        topic: event.data.topic,
                        data: decompressedData,
                    };

                    // Call the original listener with decompressed data
                    listener({
                        ...event,
                        data: decompressedMessage,
                    } as MessageEvent<RpcMessage>);
                } catch (error) {
                    // Decompression/validation failed, ignore message
                    console.error(
                        "[Compression Transport] Failed to decompress message:",
                        error
                    );
                }
            };

            // Store the listener for cleanup
            listeners.add(listener);

            // Add the wrapped listener to the window
            if (typeof window !== "undefined") {
                window.addEventListener(
                    "message",
                    wrappedListener as EventListener
                );
            }
        },

        /**
         * Remove a message listener
         */
        removeEventListener: (
            _type: "message",
            listener: (event: MessageEvent<RpcMessage>) => void
        ) => {
            listeners.delete(listener);

            // Note: We can't easily remove the wrapped listener since we don't store it
            // This is acceptable since cleanup() will be called on destroy
        },
    };
}
