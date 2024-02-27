import type { FrakWalletSdkConfig } from "../../types";
import type { IFrameRpcSchema } from "../types/rpc";
import type {
    ExtractedParametersFromRpc,
    RequestFn,
} from "../types/transport";
import { Deferred } from "../utils/Deferred";
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
}) {
    // TODO: Setup everything for the iframe listener
    // TODO: Should we split a bit the logic here? Like having one stuff handling the channels, another ones handling the connection etc?

    /*
    TODO: Need to port:
     - Channel management
     - messageHandler + messageResolver
     - waitForConnection
     - destroy
     */

    // Build our channel manager
    const channelManager = createIFrameChannelManager();

    // Build our message handler
    const messageHandler = createIFrameMessageHandler({
        frakWalletUrl: config.walletUrl,
        iframe,
        channelManager,
    });

    // Build our request function
    const request: RequestFn<IFrameRpcSchema> = async <TParameters, TReturn>(
        args: TParameters
    ) => {
        // Ensure the iframe is init
        const isConnected = await messageHandler.isConnected;
        if (!isConnected) {
            throw new Error("The iframe provider isn't connected yet");
        }

        // Create the deferrable result
        // TODO: Better typing on the result
        // TODO: Extract typing from the arg one?
        const result = new Deferred<TReturn>();

        // Create the channel
        const channelId = channelManager.createChannel((message) => {
            // TODO: Parse the message, then resolve the result
            result.resolve(message as TReturn);
            // Then close the channel
            channelManager.removeChannel(channelId);
        });

        // TODO: Format the message

        // Send the message to the iframe
        messageHandler.sendEvent({
            id: channelId,
            topic: (args as ExtractedParametersFromRpc<IFrameRpcSchema>).method,
            data: {
                compressed: "Compressed data",
                compressedHash: "Compressed hash",
            },
        });

        return result.promise;
    };

    return {
        config,
        request,
    };
}
