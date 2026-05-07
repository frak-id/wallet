import { StatusBanner } from "@frak-labs/design-system/components/StatusBanner";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "../../hook/useOnlineStatus";

/**
 * Renders an indicative top banner while the browser reports offline status.
 * Auto-shows on `offline` event, auto-hides on `online` event. No dismiss.
 */
export function OfflineBanner() {
    const { t } = useTranslation();
    const isOnline = useOnlineStatus();

    if (isOnline) return null;

    return (
        <StatusBanner
            title={t("wallet.offline.title")}
            description={t("wallet.offline.description")}
            role="status"
        />
    );
}
