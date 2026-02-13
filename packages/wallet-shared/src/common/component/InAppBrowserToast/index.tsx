import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { emitLifecycleEvent } from "../../../sdk/utils/lifecycleEvents";
import { trackGenericEvent } from "../../analytics";
import { useSessionFlag } from "../../hook/useSessionFlag";
import { inAppRedirectUrl, isInAppBrowser, isInIframe } from "../../lib/inApp";
import { Toast } from "../Toast";

type InAppBrowserToastProps = {
    getMergeToken?: () => Promise<string | undefined>;
};

export function InAppBrowserToast({ getMergeToken }: InAppBrowserToastProps) {
    const { t } = useTranslation();
    const [isDismissed, setIsDismissed] = useSessionFlag(
        "inAppBrowserToastDismissed"
    );
    const [hasAttemptedRedirect, setHasAttemptedRedirect] = useSessionFlag(
        "socialRedirectAttempted"
    );

    const handleRedirect = useCallback(async () => {
        if (isInIframe) {
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
        } else {
            trackGenericEvent("in-app-browser-redirect", {
                target: "window",
            });
            window.location.href = `${inAppRedirectUrl}${encodeURIComponent(window.location.href)}`;
        }
    }, [getMergeToken]);

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
