import { FrakRpcError } from "../../types";
import { RpcErrorCodes } from "../../types/rpc/error";
import type { IFrameEvent } from "../../types/transport";
import type { DebugInfoGatherer } from "../DebugInfo";
import type { IFrameChannelManager } from "./iframeChannelManager";
import type { IframeLifecycleManager } from "./iframeLifecycleManager";

/**
 * Config needed for the creation of an iframe message handler
 * @ignore
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

    /**
     * The debug info gatherer
     */
    debugInfo: DebugInfoGatherer;
};

/**
 * Represent the output of an iframe message handler
 * @ignore
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
 * @ignore
 */
export function createIFrameMessageHandler({
    frakWalletUrl,
    iframe,
    channelManager,
    iframeLifecycleManager,
    debugInfo,
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
    async function msgHandler(event: MessageEvent<IFrameEvent>) {
        if (!event.origin) {
            return;
        }
        // Check that the origin match the wallet
        try {
            if (
                new URL(event.origin).origin.toLowerCase() !==
                new URL(frakWalletUrl).origin.toLowerCase()
            ) {
                return;
            }
        } catch (e) {
            console.log("Unable to check frak msg origin", e);
            return;
        }

        // Check if the data are an object
        if (typeof event.data !== "object") {
            return;
        }

        // Store the debug info
        debugInfo.setLastResponse(event);

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
        resolver(event.data);
    }

    // Copy the reference to our message handler
    window.addEventListener("message", msgHandler);

    // Build our helpers function
    function sendEvent(message: IFrameEvent) {
        contentWindow.postMessage(message, {
            targetOrigin: frakWalletUrl,
        });
        debugInfo.setLastRequest(message, frakWalletUrl);
    }
    function cleanup() {
        window.removeEventListener("message", msgHandler);
    }

    return {
        sendEvent,
        cleanup,
    };
}
