import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/module/settings/SettingsCard";
import { useAuthStore } from "@/stores/authStore";
import { LinkedCredentials } from "./LinkedCredentials";
import { SessionsList } from "./SessionsList";
import { TotpEnrollment } from "./TotpEnrollment";

/**
 * `/settings` "Security" section (§5 deliverable 5): 2FA enrollment
 * (TOTP + email — both may coexist, §4.8), linked credentials overview
 * (wallet/password/Shopify), active sessions with revoke.
 */
export function SecurityCard() {
    const { t } = useTranslation();
    const authMethod = useAuthStore((state) => state.authMethod);

    // Wallet-only (legacy JWT / never-migrated) sessions have no account
    // row to attach 2FA credentials to — nothing to render here until the
    // account model resolves on next login.
    if (!authMethod) return null;

    return (
        <Stack space="l">
            <SettingsCard
                title={t("settings.security.title")}
                description={t("settings.security.description")}
            >
                <Stack space="m">
                    <TotpEnrollment />
                    <LinkedCredentials />
                </Stack>
            </SettingsCard>
            <SettingsCard
                title={t("settings.security.sessions.title")}
                description={t("settings.security.sessions.description")}
            >
                <SessionsList />
            </SettingsCard>
        </Stack>
    );
}
