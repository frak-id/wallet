import { Deferred } from "@frak-labs/frame-connector";
import type { FrakLifecycleEvent } from "../../types";
import { BACKUP_KEY } from "../../utils/constants";
import { changeIframeVisibility } from "../../utils/iframeHelper";

/** @ignore */
export type IframeLifecycleManager = {
    isConnected: Promise<boolean>;
    handleEvent: (messageEvent: FrakLifecycleEvent) => Promise<void>;
};

/**
 * Create a new iframe lifecycle handler
 * @ignore
 */
export function createIFrameLifecycleManager({
    iframe,
}: {
    iframe: HTMLIFrameElement;
}): IframeLifecycleManager {
    // Create the isConnected listener
    const isConnectedDeferred = new Deferred<boolean>();

    // Build the handler itself
    const handler = async (messageEvent: FrakLifecycleEvent) => {
        if (!("iframeLifecycle" in messageEvent)) return;

        const { iframeLifecycle: event, data } = messageEvent;

        switch (event) {
            // Resolve the isConnected promise
            case "connected":
                isConnectedDeferred.resolve(true);
                break;
            // Perform a frak backup
            case "do-backup":
                if (data.backup) {
                    localStorage.setItem(BACKUP_KEY, data.backup);
                } else {
                    localStorage.removeItem(BACKUP_KEY);
                }
                break;
            // Remove frak backup
            case "remove-backup":
                localStorage.removeItem(BACKUP_KEY);
                break;
            // Change iframe visibility
            case "show":
            case "hide":
                changeIframeVisibility({
                    iframe,
                    isVisible: event === "show",
                });
                break;
            // Handshake handling
            case "handshake": {
                iframe.contentWindow?.postMessage(
                    {
                        clientLifecycle: "handshake-response",
                        data: {
                            token: data.token,
                            currentUrl: window.location.href,
                        },
                    },
                    "*"
                );
                break;
            }
            // Redirect handling
            case "redirect": {
                const redirectUrl = new URL(data.baseRedirectUrl);

                // If we got a u append the current location dynamicly
                if (redirectUrl.searchParams.has("u")) {
                    redirectUrl.searchParams.delete("u");
                    redirectUrl.searchParams.append("u", window.location.href);
                    window.location.href = redirectUrl.toString();
                } else {
                    window.location.href = data.baseRedirectUrl;
                }
                break;
            }
        }
    };

    return {
        handleEvent: handler,
        isConnected: isConnectedDeferred.promise,
    };
}
