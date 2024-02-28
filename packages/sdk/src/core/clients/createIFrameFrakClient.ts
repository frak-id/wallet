import type { FrakWalletSdkConfig } from "../../types";
import type { FrakClient } from "../types/client.ts";
import type { IFrameRpcSchema } from "../types/rpc";
import type { ListenerRequestFn, RequestFn } from "../types/transport";
import { Deferred } from "../utils/Deferred";
import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../utils/compression";
import {
    getIFrameResponseKeyProvider,
    iFrameRequestKeyProvider,
} from "../utils/compression/rpcKeyProvider";
import { createIFrameChannelManager } from "./transports/iframeChannelManager";
import { createIFrameMessageHandler } from "./transports/iframeMessageHandler";

/**
 * Create a new iframe Frak client
 */
export function createIFrameFrakClient({
    config,
    iframe,
}: {
    config: FrakWalletSdkConfig;
    iframe: HTMLIFrameElement;
}): FrakClient {
    // Build our channel manager
    const channelManager = createIFrameChannelManager();

    // Build our message handler
    const messageHandler = createIFrameMessageHandler({
        frakWalletUrl: config.walletUrl,
        iframe,
        channelManager,
    });

    // Build our request function
    const request: RequestFn<IFrameRpcSchema> = async (args) => {
        // Ensure the iframe is init
        const isConnected = await messageHandler.isConnected;
        if (!isConnected) {
            throw new Error("The iframe provider isn't connected yet");
        }

        // Create the deferrable result
        const result = new Deferred<unknown>();

        // Get the right key provider for the result
        const resultCompressionKeyProvider = getIFrameResponseKeyProvider(args);

        // Create the channel
        const channelId = channelManager.createChannel(async (message) => {
            // Decompress the message
            const decompressed = await decompressDataAndCheckHash(
                message.data,
                resultCompressionKeyProvider
            );
            // Then resolve with the decompressed data
            result.resolve(decompressed);
            // Then close the channel
            channelManager.removeChannel(channelId);
        });

        // Compress the message to send
        const compressedMessage = await hashAndCompressData(
            args,
            iFrameRequestKeyProvider
        );

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
            throw new Error("The iframe provider isn't connected yet");
        }

        // Get the right key provider for the result
        const resultCompressionKeyProvider = getIFrameResponseKeyProvider(args);

        // Create the channel
        const channelId = channelManager.createChannel(async (message) => {
            // Decompress the message
            const decompressed = await decompressDataAndCheckHash(
                message.data,
                resultCompressionKeyProvider
            );
            // And then call the callback
            // TODO: Fix the typing here as well
            // @ts-ignore
            callback(decompressed);
        });

        // Compress the message to send
        const compressedMessage = await hashAndCompressData(
            args,
            iFrameRequestKeyProvider
        );

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
    };

    return {
        config,
        waitForConnection: messageHandler.isConnected,
        request,
        listenerRequest,
        destroy,
    };
}
