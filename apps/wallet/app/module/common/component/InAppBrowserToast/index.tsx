import { trackGenericEvent } from "@frak-labs/wallet-shared/common/analytics";
import { useSessionFlag } from "@frak-labs/wallet-shared/common/hook/useSessionFlag";
import {
    inAppRedirectUrl,
    isInAppBrowser,
    isInIframe,
} from "@frak-labs/wallet-shared/common/lib/inApp";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/sdk/utils/lifecycleEvents";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Toast } from "@/module/common/component/Toast";

/**
 * Toast component that displays when user is in an in-app browser
 */
export function InAppBrowserToast() {
    const { t } = useTranslation();
    const [isDismissed, setIsDismissed] = useSessionFlag(
        "inAppBrowserToastDismissed"
    );
    const [hasAttemptedRedirect, setHasAttemptedRedirect] = useSessionFlag(
        "socialRedirectAttempted"
    );

    const handleRedirect = useCallback(() => {
        if (isInIframe) {
            // If in an iframe, ask the parent to redirect to the new url
            trackGenericEvent("in-app-browser-redirect", {
                target: "sd-iframe",
            });
            emitLifecycleEvent({
                iframeLifecycle: "redirect",
                data: {
                    baseRedirectUrl: inAppRedirectUrl,
                },
            });
        } else {
            // Otherwise, redirect directly
            trackGenericEvent("in-app-browser-redirect", {
                target: "window",
            });
            window.location.href = `${inAppRedirectUrl}${encodeURIComponent(window.location.href)}`;
        }
    }, []);

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
