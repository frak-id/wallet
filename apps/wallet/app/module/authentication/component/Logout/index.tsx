import { isRunningInProd } from "@frak-labs/app-essentials";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogout } from "@/module/authentication/hook/useLogout";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";

/**
 * Logout row (dev-only debug tool, same gating as `CrashlyticsDebug`).
 *
 * Hidden in production: end users recover/switch accounts through the
 * dedicated flows; this exists so testers can reset auth state on a device
 * (e.g. the WebAuthn self-heal scenarios in the device test plan).
 */
export function Logout() {
    const { t } = useTranslation();
    const { logout, isLoggingOut } = useLogout();

    if (isRunningInProd) return null;

    return (
        <InfoCard variant="muted">
            <InfoRow
                icon={LogOut}
                label={t("common.logout")}
                onClick={logout}
                disabled={isLoggingOut}
            />
        </InfoCard>
    );
}
