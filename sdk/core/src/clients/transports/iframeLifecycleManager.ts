import { Deferred } from "@frak-labs/frame-connector";
import type { FrakLifecycleEvent } from "../../types";
import { BACKUP_KEY } from "../../utils/constants";
import {
    isFrakDeepLink,
    triggerDeepLinkWithFallback,
} from "../../utils/deepLinkWithFallback";
import { changeIframeVisibility } from "../../utils/iframeHelper";

/**
 * Detect iOS in-app browsers (Instagram, Facebook) where server-side
 * 302 redirects to custom URL schemes (x-safari-https://) are silently
 * swallowed by WKWebView. Direct window.location.href assignment works.
 */
const isIOSInAppBrowser = (() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    // Standard iOS or iPadOS 13+ (reports as Macintosh with touch)
    const isIOS =
        /iPhone|iPad|iPod/i.test(ua) ||
        (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    if (!isIOS) return false;
    const lower = ua.toLowerCase();
    return (
        lower.includes("instagram") ||
        lower.includes("fban") ||
        lower.includes("fbav") ||
        lower.includes("facebook")
    );
})();

/** @ignore */
export type IframeLifecycleManager = {
    isConnected: Promise<boolean>;
    handleEvent: (messageEvent: FrakLifecycleEvent) => void;
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
 * Redirect current page to Safari via x-safari-https:// scheme.
 * Used on iOS in-app browsers where backend 302 → custom scheme fails.
 */
function redirectToSafari(mergeToken?: string) {
    const url = new URL(window.location.href);
    if (mergeToken) {
        url.searchParams.set("fmt", mergeToken);
    }
    const scheme =
        url.protocol === "http:" ? "x-safari-http" : "x-safari-https";
    window.location.href = `${scheme}://${url.host}${url.pathname}${url.search}${url.hash}`;
}

/**
 * Check if this is a social/in-app-browser escape redirect (contains /common/social)
 */
function isSocialRedirect(url: string): boolean {
    return url.includes("/common/social");
}

/**
 * Handle redirect with deep link fallback
 */
function handleRedirect(
    iframe: HTMLIFrameElement,
    baseRedirectUrl: string,
    targetOrigin: string,
    mergeToken?: string,
    openInNewTab?: boolean
): void {
    // If requested, open in a new tab instead of navigating the current page.
    // This preserves the merchant page while triggering universal links.
    // Requires the iframe postMessage to include user activation delegation.
    if (openInNewTab) {
        const finalUrl = computeRedirectUrl(baseRedirectUrl, mergeToken);
        window.open(finalUrl, "_blank", "noopener");
        return;
    }

    if (isFrakDeepLink(baseRedirectUrl)) {
        const finalUrl = computeRedirectUrl(baseRedirectUrl, mergeToken);
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
    } else if (isIOSInAppBrowser && isSocialRedirect(baseRedirectUrl)) {
        // iOS WKWebView silently swallows 302 redirects to custom URL
        // schemes — bypass the server redirect entirely
        redirectToSafari(mergeToken);
    } else {
        const finalUrl = computeRedirectUrl(baseRedirectUrl, mergeToken);
        window.location.href = finalUrl;
    }
}

/**
 * Create a new iframe lifecycle handler
 * @param args
 * @param args.iframe - The iframe element used for wallet communication
 * @param args.targetOrigin - The wallet URL origin for postMessage security
 * @ignore
 */
export function createIFrameLifecycleManager({
    iframe,
    targetOrigin,
}: {
    iframe: HTMLIFrameElement;
    targetOrigin: string;
}): IframeLifecycleManager {
    // Create the isConnected listener
    const isConnectedDeferred = new Deferred<boolean>();

    // Build the handler itself
    const handler = (messageEvent: FrakLifecycleEvent) => {
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
            // Redirect handling
            case "redirect":
                handleRedirect(
                    iframe,
                    data.baseRedirectUrl,
                    targetOrigin,
                    data.mergeToken,
                    data.openInNewTab
                );
                break;
        }
    };

    return {
        handleEvent: handler,
        isConnected: isConnectedDeferred.promise,
    };
}
