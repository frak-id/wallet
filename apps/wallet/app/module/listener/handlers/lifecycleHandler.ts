import type {
    ClientLifecycleEvent,
    FrakLifecycleEvent,
} from "@frak-labs/core-sdk";
import { decompressJsonFromB64 } from "@frak-labs/core-sdk";
import type { LifecycleHandler } from "@frak-labs/frame-connector";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { getI18n } from "react-i18next";
import {
    handleHandshakeResponse,
    iframeResolvingContextAtom,
    startFetchResolvingContextViaHandshake,
} from "@/module/listener/atoms/resolvingContext";
import { restoreBackupData } from "@/module/sdk/utils/backup";
import { mapI18nConfig } from "@/module/sdk/utils/i18nMapper";
import { emitLifecycleEvent } from "@/module/sdk/utils/lifecycleEvents";
import type { SdkSession, Session } from "@/types/Session";
import { processSsoCompletion } from "./ssoHandler";

/**
 * Create a client lifecycle handler for the RPC listener
 *
 * This handler processes lifecycle events from the SDK client:
 * - modal-css: Load external CSS
 * - modal-i18n: Load i18n overrides
 * - restore-backup: Restore wallet backup
 * - heartbeat: Signal client is ready
 * - handshake-response: Complete handshake with context
 *
 * @param setReadyToHandleRequest - Callback to signal wallet is ready
 * @returns Lifecycle handler function
 */
export const createClientLifecycleHandler =
    (
        setReadyToHandleRequest: () => void
    ): LifecycleHandler<FrakLifecycleEvent> =>
    async (messageEvent, _context) => {
        if (!("clientLifecycle" in messageEvent)) return;
        const { clientLifecycle: event, data } = messageEvent;

        switch (event) {
            case "modal-css": {
                const style = document.createElement("link");
                style.rel = "stylesheet";
                style.href = data.cssLink;
                document.head.appendChild(style);
                return;
            }

            case "modal-i18n": {
                const override = data.i18n;
                if (
                    !override ||
                    typeof override !== "object" ||
                    Object.keys(override).length === 0
                ) {
                    return;
                }
                // Get the current i18n instance
                const i18n = getI18n();
                // Type assertion is safe here because we validate it's an object above
                await mapI18nConfig(override, i18n);
                return;
            }

            case "restore-backup": {
                const resolveContext = jotaiStore.get(
                    iframeResolvingContextAtom
                );
                if (!resolveContext) {
                    console.warn(
                        "Can't restore a backup until we are sure of the context"
                    );
                    return;
                }
                // Restore the backup
                await restoreBackupData({
                    backup: data.backup,
                    productId: resolveContext.productId,
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
                // Note: We need to reconstruct a MessageEvent-like object for compatibility
                const messageEvent = {
                    data: {
                        clientLifecycle: "handshake-response",
                        data: data,
                    },
                } as MessageEvent<ClientLifecycleEvent>;

                const hasContext = jotaiStore.set(
                    handleHandshakeResponse,
                    messageEvent
                );
                // Once we got a context, we can tell that we are rdy to handle request
                if (hasContext) {
                    setReadyToHandleRequest();
                }
                return;
            }

            case "sso-redirect-complete": {
                // Handle SSO redirect with compressed data from URL
                // Data arrives compressed from SDK, decompress and process here
                await handleSsoRedirectComplete(data);
                return;
            }
        }
    };

/**
 * Initialize the resolving context
 * Checks if context exists and starts handshake if needed
 *
 * @returns Whether a context is present
 */
export function initializeResolvingContext(): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    // Get the context
    const currentContext = jotaiStore.get(iframeResolvingContextAtom);

    // If we don't have one, initiate the handshake
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

/**
 * Check if we have a resolving context and emit ready event
 *
 * @returns Whether the wallet is ready to handle requests
 */
export function checkContextAndEmitReady(): boolean {
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

/**
 * Handle SSO redirect complete event from SDK URL listener
 * Decompresses SSO data and processes authentication
 *
 * Performance: Single decompression operation, reuses existing session logic
 *
 * @param data - Data containing compressed SSO string from URL
 */
async function handleSsoRedirectComplete(data: {
    compressed: string;
}): Promise<void> {
    try {
        // Decompress the SSO data (SDK passed it through without decompression)
        const compressedParam = decompressJsonFromB64<[Session, SdkSession]>(
            data.compressed
        );

        if (!compressedParam) {
            console.error("[SSO Redirect] Failed to decompress SSO data");
            return;
        }

        // Parse the SSO result
        const [session, sdkSession] = compressedParam;
        await processSsoCompletion(session, sdkSession);

        console.log("[SSO Redirect] Successfully processed SSO redirect");
    } catch (error) {
        console.error("[SSO Redirect] Error processing SSO redirect:", error);
    }
}
