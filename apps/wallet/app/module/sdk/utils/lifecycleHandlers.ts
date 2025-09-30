import {
    handleHandshakeResponse,
    iframeResolvingContextAtom,
    startFetchResolvingContextViaHandshake,
} from "@/module/listener/atoms/resolvingContext";
import { restoreBackupData } from "@/module/sdk/utils/backup";
import { emitLifecycleEvent } from "@/module/sdk/utils/lifecycleEvents";
import type { ClientLifecycleEvent, IFrameEvent } from "@frak-labs/core-sdk";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { getI18n } from "react-i18next";
import { mapI18nConfig } from "./i18nMapper";

/**
 * Setup lifecycle event handlers for the wallet listener
 * Handles handshake, heartbeat, backup restoration, etc.
 */
export function setupLifecycleHandlers(setReadyToHandleRequest: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    /**
     * Handle the lifecycle related message events
     */
    async function handleLifecycleEvents(message: MessageEvent<IFrameEvent>) {
        // Check if the message data are object
        if (typeof message.data !== "object") {
            return;
        }

        // Check if that's a client lifecycle request event
        if (
            !("clientLifecycle" in message.data) &&
            !("iframeLifecycle" in message.data)
        ) {
            return;
        }

        // Check if that's an iframe lifecycle request event
        if (!("clientLifecycle" in message.data)) {
            // Check if that's a legacy heartbeat event
            // todo: To be delete once the SDK will be updated everywhere
            if (
                "iframeLifecycle" in message.data &&
                // @ts-ignore: Legacy versions of the SDK can send this
                message.data.iframeLifecycle === "heartbeat"
            ) {
                setReadyToHandleRequest();
                return;
            }

            console.error(
                "Received an iframe lifecycle event on the iframe side, dismissing it"
            );
            return;
        }

        // Extract the client lifecycle events data
        const clientMsg = message.data;
        const { clientLifecycle } = clientMsg;

        switch (clientLifecycle) {
            case "modal-css": {
                const style = document.createElement("link");
                style.rel = "stylesheet";
                style.href = clientMsg.data.cssLink;
                document.head.appendChild(style);
                return;
            }
            case "modal-i18n": {
                const override = clientMsg.data.i18n;
                if (Object.keys(override).length === 0) {
                    return;
                }
                // Get the current i18n instance
                const i18n = getI18n();
                await mapI18nConfig(override, i18n);
                return;
            }
            case "restore-backup": {
                const context = jotaiStore.get(iframeResolvingContextAtom);
                if (!context) {
                    console.warn(
                        "Can't restore a backend until we are sure of the context"
                    );
                    return;
                }
                // Restore the backup
                await restoreBackupData({
                    backup: clientMsg.data.backup,
                    productId: context.productId,
                });
                return;
            }
            case "heartbeat": {
                // Tell that we are rdy to handle request
                setReadyToHandleRequest();
                return;
            }
            case "handshake-response": {
                // Set the handshake response
                const hasContext = jotaiStore.set(
                    handleHandshakeResponse,
                    message as MessageEvent<ClientLifecycleEvent>
                );
                // Once we got a context, we can tell that we are rdy to handle request
                if (hasContext) {
                    setReadyToHandleRequest();
                }
                return;
            }
        }
    }

    // Add the message listener
    window.addEventListener("message", handleLifecycleEvents);

    // Helper to tell when we are ready to process message
    function isContextPresent() {
        // Get the context
        const currentContext = jotaiStore.get(iframeResolvingContextAtom);
        // If we don't have one, initiate the handshake + tell that we can't handle request yet
        if (!currentContext) {
            jotaiStore.set(startFetchResolvingContextViaHandshake);
            return false;
        }
        // We have an auto context, try to fetch a more precise one using the handshake
        if (currentContext.isAutoContext) {
            jotaiStore.set(startFetchResolvingContextViaHandshake);
        }
        return true;
    }

    // Directly launch a context check
    isContextPresent();

    // Return cleanup function
    return () => {
        window.removeEventListener("message", handleLifecycleEvents);
    };
}

/**
 * Helper to check if we have a resolving context and emit ready event
 */
export function checkContextAndEmitReady() {
    if (typeof window === "undefined") {
        return false;
    }

    // Get the context
    const currentContext = jotaiStore.get(iframeResolvingContextAtom);

    // If we don't have one, initiate the handshake
    if (!currentContext) {
        jotaiStore.set(startFetchResolvingContextViaHandshake);
        console.warn("Not ready to handle request yet - no context");
        return false;
    }

    // We have an auto context, try to fetch a more precise one using the handshake
    if (currentContext.isAutoContext) {
        jotaiStore.set(startFetchResolvingContextViaHandshake);
    }

    // If we got a context, we are rdy to handle request
    emitLifecycleEvent({ iframeLifecycle: "connected" });
    return true;
}
