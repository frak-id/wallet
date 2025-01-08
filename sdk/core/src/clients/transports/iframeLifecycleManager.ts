import type { IFrameLifecycleEvent } from "../../types";
import { Deferred } from "../../utils/Deferred";
import { BACKUP_KEY } from "../../utils/constants";
import { changeIframeVisibility } from "../../utils/iframeHelper";
import { setupPrivyChannel } from "../setupPrivy";

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
    frakWalletUrl,
}: {
    iframe: HTMLIFrameElement;
    frakWalletUrl: string;
}): IframeLifecycleManager {
    // Create the isConnected listener
    const isConnectedDeferred = new Deferred<boolean>();

    // The function to send privy request
    let sendPrivyRequest:
        | ((data: unknown, targetOrigin: string) => void)
        | undefined = undefined;

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
            // Setup the privy channel
            case "setup-privy": {
                const { embeddedWalletUrl } = messageEvent.data;
                const { sendPrivyRequest: sendPrivyRequestFn } =
                    await setupPrivyChannel({
                        embeddedWalletUrl,
                        onPrivyResponse: (data: unknown) => {
                            iframe.contentWindow?.postMessage(
                                {
                                    clientLifecycle: "privy-response",
                                    data,
                                },
                                frakWalletUrl
                            );
                        },
                    });
                sendPrivyRequest = sendPrivyRequestFn;
                break;
            }
            case "privy-request":
                sendPrivyRequest?.(
                    messageEvent.data,
                    messageEvent.targetOrigin
                );
                break;
        }
    };

    return {
        handleEvent: handler,
        isConnected: isConnectedDeferred.promise,
    };
}
