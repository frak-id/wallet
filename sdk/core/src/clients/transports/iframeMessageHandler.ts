import { FrakRpcError } from "../../types";
import { RpcErrorCodes } from "../../types/rpc/error";
import type { IFrameEvent } from "../../types/transport";
import type { IFrameChannelManager } from "./iframeChannelManager";
import type { IframeLifecycleManager } from "./iframeLifecycleManager";

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

    /**
     * The lifecycle manager
     */
    iframeLifecycleManager: IframeLifecycleManager;
};

/**
 * Represent the output of an iframe message handler
 */
export type IFrameMessageHandler = {
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
 * @param frakWalletUrl
 * @param metadata
 * @param iframe
 * @param channelManager
 */
export function createIFrameMessageHandler({
    frakWalletUrl,
    iframe,
    channelManager,
    iframeLifecycleManager,
}: IFrameMessageHandlerParam): IFrameMessageHandler {
    // Ensure the window is valid
    if (typeof window === "undefined") {
        throw new FrakRpcError(
            RpcErrorCodes.configError,
            "iframe client should be used in the browser"
        );
    }
    // Ensure the iframe is valid
    if (!iframe.contentWindow) {
        throw new FrakRpcError(
            RpcErrorCodes.configError,
            "The iframe does not have a product window"
        );
    }
    const contentWindow = iframe.contentWindow;

    // Create the function that will handle incoming iframe messages
    const msgHandler = async (event: MessageEvent<IFrameEvent>) => {
        if (!(event.origin && URL.canParse(event.origin))) {
            return;
        }
        // Check that the origin match the wallet
        if (
            new URL(event.origin).origin.toLowerCase() !==
            new URL(frakWalletUrl).origin.toLowerCase()
        ) {
            return;
        }

        // Check if that's a lifecycle event
        if ("iframeLifecycle" in event.data) {
            await iframeLifecycleManager.handleEvent(event.data);
            return;
        }
        if ("clientLifecycle" in event.data) {
            console.error(
                "Client lifecycle event received on the client side, dismissing it"
            );
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
    window.addEventListener("message", msgHandler);

    // Build our helpers function
    const sendEvent = (message: IFrameEvent) => {
        contentWindow.postMessage(message, {
            targetOrigin: frakWalletUrl,
        });
    };
    const cleanup = () => {
        window.removeEventListener("message", msgHandler);
    };

    return {
        sendEvent,
        cleanup,
    };
}
