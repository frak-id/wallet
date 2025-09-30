import type {
    ClientLifecycleEvent,
    IFrameLifecycleEvent,
} from "../../types/lifecycle";
import type { DebugInfoGatherer } from "../DebugInfo";
import type { IframeLifecycleManager } from "./iframeLifecycleManager";

/**
 * Configuration for lifecycle message handler
 */
export type LifecycleMessageHandlerConfig = {
    /**
     * The Frak wallet base URL
     */
    frakWalletUrl: string;
    /**
     * The iframe element
     */
    iframe: HTMLIFrameElement;
    /**
     * The lifecycle manager for handling lifecycle events
     */
    lifecycleManager: IframeLifecycleManager;
    /**
     * Debug info gatherer
     */
    debugInfo: DebugInfoGatherer;
};

/**
 * Lifecycle message handler interface
 */
export type LifecycleMessageHandler = {
    /**
     * Send a lifecycle event to the iframe
     */
    sendLifecycleEvent: (event: ClientLifecycleEvent) => void;
    /**
     * Cleanup the message handler
     */
    cleanup: () => void;
};

/**
 * Creates a message handler for lifecycle events that are separate from RPC calls.
 *
 * This handler:
 * - Listens for iframe lifecycle events (connected, backup, handshake, etc.)
 * - Sends client lifecycle events (heartbeat, CSS, i18n, backup restoration)
 * - Works alongside the RPC client without interfering
 *
 * @param config - Handler configuration
 * @returns Lifecycle message handler
 *
 * @example
 * ```ts
 * const lifecycleHandler = createLifecycleMessageHandler({
 *   frakWalletUrl: 'https://wallet.frak.id',
 *   iframe,
 *   lifecycleManager,
 *   debugInfo
 * })
 *
 * // Send heartbeat
 * lifecycleHandler.sendLifecycleEvent({ clientLifecycle: 'heartbeat' })
 * ```
 */
export function createLifecycleMessageHandler(
    config: LifecycleMessageHandlerConfig
): LifecycleMessageHandler {
    const { frakWalletUrl, iframe, lifecycleManager, debugInfo } = config;

    // Validate iframe
    if (!iframe.contentWindow) {
        throw new Error("The iframe does not have a content window");
    }
    const contentWindow = iframe.contentWindow;

    /**
     * Handle incoming lifecycle messages
     */
    async function handleMessage(
        event: MessageEvent<IFrameLifecycleEvent | ClientLifecycleEvent>
    ) {
        if (!event.origin) return;

        // Check origin matches wallet URL
        try {
            const messageOrigin = new URL(event.origin).origin.toLowerCase();
            const expectedOrigin = new URL(frakWalletUrl).origin.toLowerCase();
            if (messageOrigin !== expectedOrigin) {
                return;
            }
        } catch (_e) {
            return;
        }

        // Validate message is an object
        if (typeof event.data !== "object") return;

        // Store debug info for all messages
        debugInfo.setLastResponse(event);

        // Check if it's a lifecycle event
        if ("iframeLifecycle" in event.data) {
            await lifecycleManager.handleEvent(event.data);
            return;
        }

        // Ignore client lifecycle events (those are outgoing)
        if ("clientLifecycle" in event.data) {
            console.error(
                "Client lifecycle event received on the client side, dismissing it"
            );
            return;
        }
    }

    // Add the message listener
    if (typeof window !== "undefined") {
        window.addEventListener(
            "message",
            handleMessage as unknown as EventListener
        );
    }

    /**
     * Send a lifecycle event to the iframe
     */
    function sendLifecycleEvent(event: ClientLifecycleEvent) {
        contentWindow.postMessage(event, {
            targetOrigin: frakWalletUrl,
        });
        debugInfo.setLastRequest(event, frakWalletUrl);
    }

    /**
     * Cleanup the handler
     */
    function cleanup() {
        if (typeof window !== "undefined") {
            window.removeEventListener(
                "message",
                handleMessage as unknown as EventListener
            );
        }
    }

    return {
        sendLifecycleEvent,
        cleanup,
    };
}
