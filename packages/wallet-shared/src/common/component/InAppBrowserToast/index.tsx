import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { emitLifecycleEvent } from "../../../sdk/utils/lifecycleEvents";
import { trackGenericEvent } from "../../analytics";
import { useSessionFlag } from "../../hook/useSessionFlag";
import {
    inAppRedirectUrl,
    isInAppBrowser,
    isInIframe,
    isIPad,
    redirectToExternalBrowser,
} from "../../lib/inApp";
import { Toast } from "../Toast";

type InAppBrowserToastProps = {
    getMergeToken?: () => Promise<string | undefined>;
    /**
     * Parent page URL from SDK handshake (iframe path only).
     * Used on iPad where all redirect approaches are blocked by
     * WKWebView — navigator.share() opens native share sheet
     * with "Open in Safari" option.
     */
    parentUrl?: string;
};

export function InAppBrowserToast({
    getMergeToken,
    parentUrl,
}: InAppBrowserToastProps) {
    const { t } = useTranslation();
    const [isDismissed, setIsDismissed] = useSessionFlag(
        "inAppBrowserToastDismissed"
    );
    const [hasAttemptedRedirect, setHasAttemptedRedirect] = useSessionFlag(
        "socialRedirectAttempted"
    );

    const handleRedirect = useCallback(async () => {
        if (isInIframe) {
            if (isIPad && parentUrl) {
                // iPad WKWebView blocks all programmatic escapes:
                // x-safari-https://, window.open, <a target="_blank">
                // all fail. navigator.share() invokes the native iOS
                // share sheet which has "Open in Safari" — system-level
                // UI that WKWebView cannot intercept.
                trackGenericEvent("in-app-browser-redirect", {
                    target: "sd-iframe-share",
                });
                const mergeToken = await getMergeToken?.();
                let targetUrl = parentUrl;
                if (mergeToken) {
                    const url = new URL(parentUrl);
                    url.searchParams.set("fmt", mergeToken);
                    targetUrl = url.toString();
                }
                await triggerNativeShare(targetUrl);
            } else {
                // iPhone/other: lifecycle event → parent uses x-safari-https://
                trackGenericEvent("in-app-browser-redirect", {
                    target: "sd-iframe",
                });
                const mergeToken = await getMergeToken?.();
                emitLifecycleEvent({
                    iframeLifecycle: "redirect",
                    data: {
                        baseRedirectUrl: inAppRedirectUrl,
                        mergeToken,
                    },
                });
            }
        } else {
            trackGenericEvent("in-app-browser-redirect", {
                target: "window",
            });
            redirectToExternalBrowser(window.location.href);
        }
    }, [getMergeToken, parentUrl]);

    // Auto-redirect on first detection — skip on iPad since
    // navigator.share requires user gesture.
    useEffect(() => {
        if (!isInAppBrowser || hasAttemptedRedirect) return;
        if (isIPad && isInIframe) return;

        setHasAttemptedRedirect(true);
        handleRedirect();
    }, [hasAttemptedRedirect, setHasAttemptedRedirect, handleRedirect]);

    const handleDismiss = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation(); // Prevent toast click when clicking dismiss
            setIsDismissed(true);
        },
        [setIsDismissed]
    );

    // Don't show if not in app browser or already dismissed
    if (!isInAppBrowser || isDismissed) {
        return null;
    }

    return (
        <Toast
            text={t("wallet.inAppBrowser.warning")}
            ariaLabel={t("wallet.inAppBrowser.clickToOpen")}
            ariaDismissLabel={t("wallet.inAppBrowser.dismiss")}
            onClick={handleRedirect}
            onDismiss={handleDismiss}
        />
    );
}

/**
 * Trigger native share sheet via Web Share API.
 * Falls back to clipboard copy if share is unavailable.
 */
async function triggerNativeShare(url: string): Promise<void> {
    if (navigator.share) {
        try {
            await navigator.share({ url });
            return;
        } catch {
            // User cancelled or API blocked — fall through to clipboard
        }
    }
    // Fallback: copy to clipboard
    await copyToClipboard(url);
    alert("Link copied! Open Safari and paste in the address bar.");
}

/**
 * Copy text to clipboard with execCommand fallback for cross-origin
 * iframes where navigator.clipboard may be blocked by Permissions-Policy.
 */
async function copyToClipboard(text: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
    }
}
