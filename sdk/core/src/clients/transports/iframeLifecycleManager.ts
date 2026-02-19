import { Deferred } from "@frak-labs/frame-connector";
import type { FrakLifecycleEvent } from "../../types";
import { getClientId } from "../../utils/clientId";
import { BACKUP_KEY } from "../../utils/constants";
import {
    isFrakDeepLink,
    triggerDeepLinkWithFallback,
} from "../../utils/deepLinkWithFallback";
import { changeIframeVisibility } from "../../utils/iframeHelper";

/** @ignore */
export type IframeLifecycleManager = {
    isConnected: Promise<boolean>;
    handleEvent: (messageEvent: FrakLifecycleEvent) => Promise<void>;
};

/**
 * Handle backup storage
 */
function handleBackup(backup: string | undefined): void {
    if (backup) {
        localStorage.setItem(BACKUP_KEY, backup);
    } else {
        localStorage.removeItem(BACKUP_KEY);
    }
}

/**
 * Handle handshake with iframe — sends client metadata so the listener can resolve the correct merchant
 * @param iframe - The iframe element to post the handshake response to
 * @param token - The handshake token received from the iframe
 * @param targetOrigin - The target origin for postMessage security
 * @param configDomain - Optional override domain for merchant resolution in tunneled/proxied environments
 */
function handleHandshake(
    iframe: HTMLIFrameElement,
    token: string,
    targetOrigin: string,
    configDomain?: string
): void {
    const url = new URL(window.location.href);
    const pendingMergeToken = url.searchParams.get("fmt") ?? undefined;

    iframe.contentWindow?.postMessage(
        {
            clientLifecycle: "handshake-response",
            data: {
                token,
                currentUrl: window.location.href,
                clientId: getClientId(),
                pendingMergeToken,
                configDomain,
            },
        },
        targetOrigin
    );

    if (pendingMergeToken) {
        url.searchParams.delete("fmt");
        window.history.replaceState({}, "", url.toString());
    }
}

/**
 * Compute final redirect URL with parameter substitution
 */
function computeRedirectUrl(
    baseRedirectUrl: string,
    mergeToken?: string
): string {
    try {
        const redirectUrl = new URL(baseRedirectUrl);
        if (!redirectUrl.searchParams.has("u")) {
            return baseRedirectUrl;
        }

        redirectUrl.searchParams.delete("u");
        redirectUrl.searchParams.append("u", window.location.href);

        if (mergeToken) {
            redirectUrl.searchParams.append("fmt", mergeToken);
        }

        return redirectUrl.toString();
    } catch {
        return baseRedirectUrl;
    }
}

/**
 * Handle redirect with deep link fallback
 */
function handleRedirect(
    iframe: HTMLIFrameElement,
    baseRedirectUrl: string,
    targetOrigin: string,
    mergeToken?: string
): void {
    const finalUrl = computeRedirectUrl(baseRedirectUrl, mergeToken);

    if (isFrakDeepLink(baseRedirectUrl)) {
        triggerDeepLinkWithFallback(finalUrl, {
            onFallback: () => {
                iframe.contentWindow?.postMessage(
                    {
                        clientLifecycle: "deep-link-failed",
                        data: { originalUrl: finalUrl },
                    },
                    targetOrigin
                );
            },
        });
    } else {
        window.location.href = finalUrl;
    }
}

/**
 * Create a new iframe lifecycle handler
 * @param args
 * @param args.iframe - The iframe element used for wallet communication
 * @param args.targetOrigin - The wallet URL origin for postMessage security
 * @param args.configDomain - Optional domain override forwarded during handshake for tunneled/proxied environments
 * @ignore
 */
export function createIFrameLifecycleManager({
    iframe,
    targetOrigin,
    configDomain,
}: {
    iframe: HTMLIFrameElement;
    targetOrigin: string;
    configDomain?: string;
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
                handleBackup(data.backup);
                break;
            // Remove frak backup
            case "remove-backup":
                localStorage.removeItem(BACKUP_KEY);
                break;
            // Change iframe visibility
            case "show":
            case "hide":
                changeIframeVisibility({ iframe, isVisible: event === "show" });
                break;
            // Handshake handling
            case "handshake":
                handleHandshake(iframe, data.token, targetOrigin, configDomain);
                break;
            // Redirect handling
            case "redirect":
                handleRedirect(
                    iframe,
                    data.baseRedirectUrl,
                    targetOrigin,
                    data.mergeToken
                );
                break;
        }
    };

    return {
        handleEvent: handler,
        isConnected: isConnectedDeferred.promise,
    };
}
