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
     * Used on iPad where all programmatic redirect approaches
     * are blocked by WKWebView — clipboard copy is the only
     * reliable escape path.
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
                // x-safari-https://, window.open, <a target="_blank">,
                // navigator.share (no Safari option in share sheet).
                // Clipboard copy + instruction is the only path.
                trackGenericEvent("in-app-browser-redirect", {
                    target: "sd-iframe-clipboard",
                });
                const mergeToken = await getMergeToken?.();
                let targetUrl = parentUrl;
                if (mergeToken) {
                    const url = new URL(parentUrl);
                    url.searchParams.set("fmt", mergeToken);
                    targetUrl = url.toString();
                }
                await copyToClipboard(targetUrl);
                alert(t("wallet.inAppBrowser.clipboardAlert"));
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
    // clipboard copy without user gesture has no visible feedback.
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
