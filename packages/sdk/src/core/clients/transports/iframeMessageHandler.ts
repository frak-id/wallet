import { FrakRpcError } from "../../types";
import { RpcErrorCodes } from "../../types/rpc/error";
import type { IFrameEvent } from "../../types/transport";
import { Deferred } from "../../utils/Deferred";
import { changeIframeVisibility } from "../../utils/iframeHelper";
import type { IFrameChannelManager } from "./iframeChannelManager";

/**
 * Config needed for the creation of an iframe message handler
 */
export type IFrameMessageHandlerParam = {
    /**
     * the nexus wallet base url
     */
    nexusWalletUrl: string;
    /**
     * The metadata of the app
     */
    metadata?: {
        css?: string;
    };
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
 * @param nexusWalletUrl
 * @param metadata
 * @param iframe
 * @param channelManager
 */
export function createIFrameMessageHandler({
    nexusWalletUrl,
    metadata,
    iframe,
    channelManager,
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
            "The iframe does not have a content window"
        );
    }
    const contentWindow = iframe.contentWindow;

    // Create our deferred promise
    const isConnectedDeferred = new Deferred<boolean>();

    // Create the function that will handle incoming iframe messages
    const msgHandler = async (event: MessageEvent<IFrameEvent>) => {
        if (!event.origin) {
            return;
        }
        // Check that the origin match the wallet
        if (
            new URL(event.origin).origin.toLowerCase() !==
            new URL(nexusWalletUrl).origin.toLowerCase()
        ) {
            return;
        }

        // Check if that's a lifecycle event
        if ("lifecycle" in event.data) {
            switch (event.data.lifecycle) {
                case "connected":
                    isConnectedDeferred.resolve(true);
                    break;
                case "show":
                case "hide":
                    changeIframeVisibility({
                        iframe,
                        isVisible: event.data.lifecycle === "show",
                    });
                    break;
            }
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
            targetOrigin: nexusWalletUrl,
        });
    };
    const cleanup = () => {
        window.removeEventListener("message", msgHandler);
    };

    // Mark it as connected only if the event is 'connected'
    const isConnected = injectCssOnConnect({
        isConnected: isConnectedDeferred.promise,
        metadata,
        sendEvent,
    });

    return {
        isConnected,
        sendEvent,
        cleanup,
    };
}

/**
 * Inject CSS when modal is connected if needed
 * @param isConnected
 * @param metadata
 * @param sendEvent
 */
function injectCssOnConnect({
    isConnected,
    metadata,
    sendEvent,
}: {
    isConnected: Promise<boolean>;
    metadata?: { css?: string };
    sendEvent: (message: IFrameEvent) => void;
}): Promise<boolean> {
    const css = metadata?.css;
    if (!css) {
        return isConnected;
    }

    return isConnected.then((connected) => {
        sendEvent({
            lifecycle: "modal-css",
            data: css,
        });
        return connected;
    });
}
