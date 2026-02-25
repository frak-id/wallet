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
     * Used on iPad where x-safari-https:// is blocked — we
     * window.open the parent URL directly from the iframe to
     * preserve user gesture context.
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
                // iPad: x-safari-https:// silently blocked by WKWebView.
                // window.open from iframe preserves user gesture context.
                trackGenericEvent("in-app-browser-redirect", {
                    target: "sd-iframe-window-open",
                });
                const mergeToken = await getMergeToken?.();
                let targetUrl = parentUrl;
                if (mergeToken) {
                    const url = new URL(parentUrl);
                    url.searchParams.set("fmt", mergeToken);
                    targetUrl = url.toString();
                }
                window.open(targetUrl, "_blank");
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

    // Auto-redirect if this is the first time detecting in-app browser and no redirect has been attempted
    useEffect(() => {
        if (!isInAppBrowser || hasAttemptedRedirect) return;

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
