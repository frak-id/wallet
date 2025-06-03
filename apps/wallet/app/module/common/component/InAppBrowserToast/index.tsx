import {
    inAppBrowserToastDismissedAtom,
    socialRedirectAttemptedAtom,
} from "@/module/common/atoms/inAppBrowser";
import { Toast } from "@/module/common/component/Toast";
import { useIsInAppBrowser } from "@/module/common/hook/useIsInAppBrowser";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { emitLifecycleEvent } from "../../../sdk/utils/lifecycleEvents";

/**
 * Toast component that displays when user is in an in-app browser
 */
export function InAppBrowserToast() {
    const { t } = useTranslation();
    const { isInAppBrowser, isInIframe, redirectUrl } = useIsInAppBrowser();
    const [isDismissed, setIsDismissed] = useAtom(
        inAppBrowserToastDismissedAtom
    );
    const [hasAttemptedRedirect, setHasAttemptedRedirect] = useAtom(
        socialRedirectAttemptedAtom
    );

    // Auto-redirect if this is the first time detecting in-app browser and no redirect has been attempted
    useEffect(() => {
        if (!redirectUrl) return;
        if (isInIframe || !isInAppBrowser || hasAttemptedRedirect) return;

        setHasAttemptedRedirect(true);
        handleRedirect();
    }, [
        isInAppBrowser,
        isInIframe,
        hasAttemptedRedirect,
        redirectUrl,
        setHasAttemptedRedirect,
    ]);

    const handleRedirect = useCallback(() => {
        if (!redirectUrl) return;

        if (isInIframe) {
            // If in an iframe, ask the parent to redirect to the new url
            emitLifecycleEvent({
                iframeLifecycle: "redirect",
                data: {
                    baseRedirectUrl: redirectUrl,
                },
            });
        } else {
            // Otherwise, redirect directly
            window.location.href = `${redirectUrl}${encodeURIComponent(window.location.href)}`;
        }
    }, [redirectUrl, isInIframe]);

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
