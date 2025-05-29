import {
    inAppBrowserToastDismissedAtom,
    socialRedirectAttemptedAtom,
} from "@/module/common/atoms/inAppBrowser";
import { Warning } from "@/module/common/component/Warning";
import { useIsInAppBrowser } from "@/module/common/hook/useIsInAppBrowser";
import { useAtom } from "jotai";
import { X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

/**
 * Toast component that displays when user is in an in-app browser
 */
export function InAppBrowserToast() {
    const { t } = useTranslation();
    const { isInAppBrowser, redirectUrl } = useIsInAppBrowser();
    const [isDismissed, setIsDismissed] = useAtom(
        inAppBrowserToastDismissedAtom
    );
    const [hasAttemptedRedirect, setHasAttemptedRedirect] = useAtom(
        socialRedirectAttemptedAtom
    );

    // Auto-redirect if this is the first time detecting in-app browser and no redirect has been attempted
    useEffect(() => {
        if (isInAppBrowser && !hasAttemptedRedirect && redirectUrl) {
            setHasAttemptedRedirect(true);
            window.location.href = redirectUrl;
        }
    }, [
        isInAppBrowser,
        hasAttemptedRedirect,
        redirectUrl,
        setHasAttemptedRedirect,
    ]);

    const handleToastClick = useCallback(() => {
        if (redirectUrl) {
            window.location.href = redirectUrl;
        }
    }, [redirectUrl]);

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
        <div className={styles.inAppBrowserToast}>
            <button
                type="button"
                className={styles.inAppBrowserToast__clickable}
                onClick={handleToastClick}
                aria-label={t("wallet.inAppBrowser.clickToOpen")}
            >
                <Warning text={t("wallet.inAppBrowser.warning")}>
                    <div className={styles.inAppBrowserToast__actions}>
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className={styles.inAppBrowserToast__dismissButton}
                            aria-label="Dismiss inapp browser warning"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </Warning>
            </button>
        </div>
    );
}
