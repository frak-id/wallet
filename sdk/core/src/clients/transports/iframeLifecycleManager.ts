import type { IFrameLifecycleEvent } from "../../types";
import { Deferred } from "../../utils/Deferred";
import { BACKUP_KEY } from "../../utils/constants";
import { changeIframeVisibility } from "../../utils/iframeHelper";

/** @ignore */
export type IframeLifecycleManager = {
    isConnected: Promise<boolean>;
    handleEvent: (messageEvent: IFrameLifecycleEvent) => Promise<void>;
};

/**
 * Create a new iframe lifecycle handler
 * @ignore
 */
export function createIFrameLifecycleManager({
    iframe,
}: { iframe: HTMLIFrameElement }): IframeLifecycleManager {
    // Create the isConnected listener
    const isConnectedDeferred = new Deferred<boolean>();

    // Build the handler itself
    const handler = async (messageEvent: IFrameLifecycleEvent) => {
        switch (messageEvent.iframeLifecycle) {
            // Resolve the isConnected promise
            case "connected":
                isConnectedDeferred.resolve(true);
                break;
            // Perform a nexus backup
            case "do-backup":
                if (messageEvent.data.backup) {
                    localStorage.setItem(BACKUP_KEY, messageEvent.data.backup);
                } else {
                    localStorage.removeItem(BACKUP_KEY);
                }
                break;
            // Remove nexus backup
            case "remove-backup":
                localStorage.removeItem(BACKUP_KEY);
                break;
            // Change iframe visibility
            case "show":
            case "hide":
                changeIframeVisibility({
                    iframe,
                    isVisible: messageEvent.iframeLifecycle === "show",
                });
                break;
            // Handshake handling
            case "handshake": {
                iframe.contentWindow?.postMessage(
                    {
                        clientLifecycle: "handshake-response",
                        data: {
                            token: messageEvent.data.token,
                            currentUrl: window.location.href,
                        },
                    },
                    "*"
                );
                break;
            }
        }
    };

    return {
        handleEvent: handler,
        isConnected: isConnectedDeferred.promise,
    };
}
