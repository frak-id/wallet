import type { IFrameEvent } from "../../types/transport";
import { Deferred } from "../../utils/Deferred";
import type { IFrameChannelManager } from "./iframeChannelManager";

/**
 * Config needed for the creation of an iframe message handler
 */
export type IFrameMessageHandlerParam = {
    /**
     * the frak wallet base url
     */
    frakWalletUrl: string;
    /**
     * The iframe on which we will bound our listener
     */
    iframe: HTMLIFrameElement;

    /**
     * The channel manager that will be used to manage the channels
     */
    channelManager: IFrameChannelManager;
};

/**
 * Represent the output of an iframe message handler
 */
export type IFrameMessageHandler = {
    /**
     * Promise that will resolve when the iframe is connected
     */
    isConnected: Promise<boolean>;
    /**
     * Function used to send an event to the iframe
     */
    sendEvent: (message: IFrameEvent) => void;
    /**
     * Cleanup the iframe message handler
     */
    cleanup: () => void;
};

/**
 * Create an iframe message handler
 * @param frakWalletBaseUrl
 * @param iframe
 * @param channelManager
 */
export function createIFrameMessageHandler({
    frakWalletUrl,
    iframe,
    channelManager,
}: IFrameMessageHandlerParam): IFrameMessageHandler {
    // Ensure the iframe is valid
    if (!iframe.contentWindow) {
        throw new Error("The iframe does not have a content window");
    }
    const contentWindow = iframe.contentWindow;

    // Create our deferred promise
    const isConnected = new Deferred<boolean>();

    // Create the function that will handle incoming iframe messages
    const msgHandler = async (event: MessageEvent<IFrameEvent>) => {
        // TODO: Uri check???

        // Check if that's a lifecycle event
        if ("lifecycle" in event.data) {
            // Mark it as connected only if the event is 'connected'
            isConnected.resolve(event.data.lifecycle === "connected");
            return;
        }

        // Otherwise, ensure we got a channel with a resolver
        const channel = event.data.id;
        const resolver = channelManager.getRpcResolver(channel);
        if (!resolver) {
            return;
        }

        // If founded, call the resolver
        await resolver(event.data);
    };

    // Copy the reference to our message handler
    contentWindow.addEventListener("message", msgHandler);

    // Build our helpers function
    const sendEvent = (message: IFrameEvent) => {
        contentWindow.postMessage(message, {
            targetOrigin: frakWalletUrl,
        });
    };
    const cleanup = () => {
        contentWindow.removeEventListener("message", msgHandler);
    };

    return {
        isConnected: isConnected.promise,
        sendEvent,
        cleanup,
    };
}
