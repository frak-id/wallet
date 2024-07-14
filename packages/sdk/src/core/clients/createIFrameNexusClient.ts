import { FrakRpcError } from "../types";
import type { NexusClient } from "../types/client";
import type { NexusWalletSdkConfig } from "../types/config";
import type { IFrameRpcSchema } from "../types/rpc";
import { RpcErrorCodes } from "../types/rpc/error";
import type {
    ListenerRequestFn,
    RequestFn,
    RpcResponse,
} from "../types/transport";
import { Deferred } from "../utils/Deferred";
import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../utils/compression";
import { createIFrameChannelManager } from "./transports/iframeChannelManager";
import { createIFrameMessageHandler } from "./transports/iframeMessageHandler";

/**
 * Create a new iframe Nexus client
 */
export function createIFrameNexusClient({
    config,
    iframe,
}: {
    config: NexusWalletSdkConfig;
    iframe: HTMLIFrameElement;
}): NexusClient {
    // Build our channel manager
    const channelManager = createIFrameChannelManager();

    // Build our message handler
    const messageHandler = createIFrameMessageHandler({
        nexusWalletUrl: config.walletUrl,
        iframe,
        channelManager,
    });

    // Build our request function
    const request: RequestFn<IFrameRpcSchema> = async <TParameters, TResult>(
        args: TParameters
    ) => {
        // Ensure the iframe is init
        const isConnected = await messageHandler.isConnected;
        if (!isConnected) {
            throw new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            );
        }

        // Create the deferrable result
        const result = new Deferred<TResult>();

        // Create the channel
        const channelId = channelManager.createChannel(async (message) => {
            // Decompress the message
            const decompressed = await decompressDataAndCheckHash<
                RpcResponse<IFrameRpcSchema>
            >(message.data);
            // If it contains an error, reject it
            if (decompressed.error) {
                result.reject(
                    new FrakRpcError(
                        decompressed.error.code,
                        decompressed.error.message,
                        decompressed.error?.data
                    )
                );
            } else {
                // Otherwise, resolve with the right status
                result.resolve(decompressed.result as TResult);
            }
            // Then close the channel
            channelManager.removeChannel(channelId);
        });

        // Compress the message to send
        const compressedMessage = await hashAndCompressData(args);

        // Send the message to the iframe
        messageHandler.sendEvent({
            id: channelId,
            // @ts-ignore, todo: idk why the fck it's needed
            topic: args.method,
            data: compressedMessage,
        });

        return result.promise;
    };

    // Build our listener function
    const listenerRequest: ListenerRequestFn<IFrameRpcSchema> = async (
        args,
        callback
    ) => {
        // Ensure the iframe is init
        const isConnected = await messageHandler.isConnected;
        if (!isConnected) {
            throw new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            );
        }

        // Create the channel
        const channelId = channelManager.createChannel(async (message) => {
            // Decompress the message
            const decompressed = await decompressDataAndCheckHash<
                RpcResponse<IFrameRpcSchema>
            >(message.data);
            // Transmit the result if it's a success
            if (decompressed.result) {
                // @ts-ignore
                callback(decompressed.result);
            } else {
                // todo: throw an error? Callback with an error?
            }
        });

        // Compress the message to send
        const compressedMessage = await hashAndCompressData(args);

        // Send the message to the iframe
        messageHandler.sendEvent({
            id: channelId,
            topic: args.method,
            data: compressedMessage,
        });
    };

    // Build our destroy function
    const destroy = async () => {
        // Destroy the channel manager
        channelManager.destroy();
        // Cleanup the message handler
        messageHandler.cleanup();
        // Remove the iframe
        iframe.remove();
    };

    return {
        config,
        waitForConnection: messageHandler.isConnected,
        request,
        listenerRequest,
        destroy,
    };
}
