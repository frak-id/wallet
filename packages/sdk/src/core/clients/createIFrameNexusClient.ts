import { FrakRpcError } from "../types";
import type { NexusClient } from "../types/client";
import type { NexusWalletSdkConfig } from "../types/config";
import type { IFrameRpcSchema } from "../types/rpc";
import { RpcErrorCodes } from "../types/rpc/error";
import type { ListenerRequestFn, RequestFn } from "../types/transport";
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
    const request: RequestFn<IFrameRpcSchema> = async (args) => {
        // Ensure the iframe is init
        const isConnected = await messageHandler.isConnected;
        if (!isConnected) {
            throw new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            );
        }

        // Create the deferrable result
        const result = new Deferred<unknown>();

        // Create the channel
        const channelId = channelManager.createChannel(async (message) => {
            // Decompress the message
            const decompressed = await decompressDataAndCheckHash(message.data);
            // Then resolve with the decompressed data
            result.resolve(decompressed);
            // Then close the channel
            channelManager.removeChannel(channelId);
        });

        // Compress the message to send
        const compressedMessage = await hashAndCompressData(args);

        // Send the message to the iframe
        messageHandler.sendEvent({
            id: channelId,
            topic: args.method,
            data: compressedMessage,
        });

        // TODO: How to clean a proper typing onm the result?
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        return result.promise as any;
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
            const decompressed = await decompressDataAndCheckHash(message.data);
            // And then call the callback
            // TODO: Fix the typing here as well
            // @ts-ignore
            callback(decompressed);
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
