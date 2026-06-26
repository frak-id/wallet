import { AlertMessage } from "@frak-labs/design-system/components/AlertMessage";
import { ClockIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { create, useStore } from "zustand";
import { modalStore } from "@/module/stores/modalStore";

/**
 * Snooze key — stored in sessionStorage so it resets when the tab closes.
 * Once the banner is dismissed it will not re-appear in the same tab/session.
 */
const SNOOZE_KEY = "frak_session_expiry_banner_snoozed";

type BannerStore = {
    visible: boolean;
    show: () => void;
    hide: () => void;
};

/**
 * Tiny store that drives the session-expiring banner's visibility.
 * Decoupled from sessionStorage so tests can control it without DOM.
 */
export const sessionBannerStore = create<BannerStore>()((set) => ({
    visible: false,
    show: () => {
        // Respect the per-tab snooze set when the user dismissed the banner.
        if (sessionStorage.getItem(SNOOZE_KEY)) return;
        set({ visible: true });
    },
    hide: () => {
        sessionStorage.setItem(SNOOZE_KEY, "1");
        set({ visible: false });
    },
}));

/**
 * Passive, dismissible banner shown when the wallet token is in its grace
 * window (expiring within 7 days but not yet expired).
 *
 * - Appears at most once per browser tab session (snoozed via sessionStorage).
 * - The action opens the blocking re-auth modal.
 * - Dismissing it snoozes until the tab is closed.
 * - Not shown on every focus/visibilitychange — the guard hook calls
 *   `sessionBannerStore.show()` once, and the snooze prevents re-display.
 *
 * Rendered inside the app's top `BannerStack`, so it uses the design-system
 * `AlertMessage` like its `OfflineBanner`/`WebauthnErrorToast` siblings.
 */
export function SessionExpiringBanner() {
    const { t } = useTranslation();
    const visible = useStore(sessionBannerStore, (s) => s.visible);
    const hide = useStore(sessionBannerStore, (s) => s.hide);

    if (!visible) return null;

    const openReauthModal = () => {
        hide();
        modalStore.getState().openModal({ id: "reauth", expired: false });
    };

    return (
        <AlertMessage
            tone="warning"
            icon={<ClockIcon />}
            title={t("wallet.sessionExpiring.title", "Session expiring soon")}
            description={t(
                "wallet.sessionExpiring.banner",
                "Refresh now to stay signed in."
            )}
            action={{
                label: t(
                    "wallet.sessionExpiring.bannerAction",
                    "Refresh session"
                ),
                onClick: openReauthModal,
            }}
            onDismiss={hide}
            dismissLabel={t(
                "wallet.sessionExpiring.bannerDismiss",
                "Dismiss session expiry notice"
            )}
        />
    );
}
