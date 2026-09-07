import {
    getBackendUrl,
    isInAppBrowser,
    redirectToExternalBrowser,
} from "@frak-labs/core-sdk";
import { InAppBanner } from "@frak-labs/design-system/components/InAppBanner";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../../analytics";
import { useSessionFlag } from "../../hook/useSessionFlag";
import { isInIframe, isIPad } from "../../lib/inApp";
import { emitLifecycleEvent } from "../../utils/lifecycleEvents";

type InAppBrowserToastProps = {
    getMergeToken?: () => Promise<string | undefined>;
    /**
     * Parent page URL from SDK handshake (iframe path only).
     * Used on iPad where all programmatic redirect approaches
     * are blocked by WKWebView — clipboard copy is the only
     * reliable escape path.
     */
    parentUrl?: string;
    /**
     * Resolved merchant origin, supplied on the iframe path. The redirect
     * carries a merge token, so it must not reach an unexpected parent.
     */
    targetOrigin?: string;
};

export function InAppBrowserToast({
    getMergeToken,
    parentUrl,
    targetOrigin,
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
            if (isIPad) {
                // iPad WKWebView blocks all programmatic escapes:
                // x-safari-https://, window.open, <a target="_blank">,
                // navigator.share. Clipboard copy + instruction is the only
                // path, and no origin guard applies: the merge token goes
                // to the user's clipboard, not to a frame that can read it.
                trackEvent("in_app_browser_redirected", {
                    target: "sd-iframe-clipboard",
                });
                const mergeToken = await getMergeToken?.();
                const targetUrl = appendMergeToken(
                    parentUrl ?? window.location.href,
                    mergeToken
                );
                const hasCopiedLink = await copyToClipboard(targetUrl);
                alert(
                    hasCopiedLink
                        ? t("wallet.inAppBrowser.clipboardAlert")
                        : t("wallet.inAppBrowser.clipboardManualAlert", {
                              url: targetUrl,
                          })
                );
            } else {
                await redirectViaParent(targetOrigin, getMergeToken);
            }
        } else {
            trackEvent("in_app_browser_redirected", {
                target: "window",
            });
            redirectToExternalBrowser(window.location.href);
        }
    }, [getMergeToken, parentUrl, targetOrigin, t]);

    // Auto-redirect on first detection — skip on iPad since
    // clipboard copy without user gesture has no visible feedback.
    useEffect(() => {
        if (!isInAppBrowser || hasAttemptedRedirect) return;
        if (isIPad && isInIframe) return;

        setHasAttemptedRedirect(true);
        handleRedirect();
    }, [hasAttemptedRedirect, setHasAttemptedRedirect, handleRedirect]);

    const handleDismiss = useCallback(() => {
        setIsDismissed(true);
    }, [setIsDismissed]);

    // Don't show if not in app browser or already dismissed
    if (!isInAppBrowser || isDismissed) {
        return null;
    }

    return (
        <InAppBanner
            title={t("wallet.inAppBrowser.title")}
            description={t("wallet.inAppBrowser.description")}
            cta={t("wallet.inAppBrowser.cta")}
            dismissLabel={t("wallet.inAppBrowser.dismiss")}
            onAction={handleRedirect}
            onDismiss={handleDismiss}
        />
    );
}

/**
 * iPhone/other: the parent escapes via x-safari-https://. The redirect carries
 * a merge token, so an unresolved origin sends nothing.
 */
async function redirectViaParent(
    targetOrigin: string | undefined,
    getMergeToken?: () => Promise<string | undefined>
) {
    if (!targetOrigin) {
        console.warn("[InAppBrowser] Origin not resolved, redirect dropped");
        return;
    }
    trackEvent("in_app_browser_redirected", { target: "sd-iframe" });
    const mergeToken = await getMergeToken?.();
    emitLifecycleEvent(
        {
            iframeLifecycle: "redirect",
            data: {
                baseRedirectUrl: `${process.env.BACKEND_URL ?? getBackendUrl()}/common/social?u=`,
                mergeToken,
            },
        },
        { targetOrigin }
    );
}

/**
 * Copy text to clipboard with execCommand fallback for cross-origin
 * iframes where navigator.clipboard may be blocked by Permissions-Policy.
 */
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {} // Expected in cross-origin iframes; falls through to execCommand

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
}

function appendMergeToken(urlString: string, mergeToken?: string): string {
    if (!mergeToken) {
        return urlString;
    }

    try {
        const url = new URL(urlString);
        url.searchParams.set("fmt", mergeToken);
        return url.toString();
    } catch {
        const separator = urlString.includes("?") ? "&" : "?";
        return `${urlString}${separator}fmt=${encodeURIComponent(mergeToken)}`;
    }
}
