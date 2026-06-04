import { isRunningInProd } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { HeartIcon, SettingsIcon } from "@frak-labs/design-system/icons";
import {
    authenticationStore,
    selectLastAuthenticationAt,
    useGetActivePairings,
} from "@frak-labs/wallet-shared";
import { Mail, Shield } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useCurrentEmail } from "@/module/authentication/hook/useCurrentEmail";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { Title } from "@/module/common/component/Title";
// import { Logout } from "@/module/authentication/component/Logout";
import { MoneriumConnect } from "@/module/monerium/component/MoneriumConnect";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { useRecoveryStatus } from "@/module/recovery-setup/hook/useRecoveryStatus";
import { isExpiringSoon } from "@/module/recovery-setup/utils/recoveryDates";
import { CrashlyticsDebug } from "@/module/settings/component/CrashlyticsDebug";
import { PrivateKey } from "@/module/settings/component/PrivateKey";
import { ProfileIdentityCard } from "@/module/settings/component/ProfileIdentityCard";
import { ProfileLinksCard } from "@/module/settings/component/ProfileLinksCard";
import { ProfilePreferencesCard } from "@/module/settings/component/ProfilePreferencesCard";
// import { ProfileSecurityCard } from "@/module/settings/component/ProfileSecurityCard";
import * as styles from "./index.css";

function EmailSecurityCard({
    hasEmail,
    isEmailVerified,
    hasRecovery,
    recoveryExpiringSoon,
}: {
    hasEmail: boolean;
    isEmailVerified: boolean;
    hasRecovery: boolean;
    recoveryExpiringSoon: boolean;
}) {
    const { t } = useTranslation();

    if (!hasEmail) {
        return (
            <InfoCard>
                <InfoRow
                    icon={Mail}
                    label={t("wallet.profile.addEmail")}
                    to="/profile/add-email"
                />
            </InfoCard>
        );
    }
    if (!isEmailVerified) {
        return (
            <InfoCard>
                <InfoRow
                    icon={Mail}
                    label={t("wallet.profile.verifyEmail")}
                    to="/profile/verify-email"
                />
            </InfoCard>
        );
    }
    if (!hasRecovery || recoveryExpiringSoon) {
        return (
            <InfoCard>
                <InfoRow
                    icon={Shield}
                    label={t(
                        hasRecovery
                            ? "wallet.profile.refreshRecovery"
                            : "wallet.profile.setupRecovery"
                    )}
                    to="/profile/recovery"
                />
            </InfoCard>
        );
    }
    return (
        <InfoCard>
            <InfoRow
                icon={Shield}
                label={t("wallet.profile.recoveryConfiguration")}
                to="/profile/recovery"
            />
        </InfoCard>
    );
}

export function ProfilePage() {
    const { t, i18n } = useTranslation();
    const version = process.env.APP_VERSION;
    const displayVersion =
        version && version !== "UNKNOWN" ? version : undefined;
    const lastAuthenticationAt = useStore(
        authenticationStore,
        selectLastAuthenticationAt
    );
    const formattedLastAuthentication = useMemo(() => {
        if (!lastAuthenticationAt) return null;

        const locale = i18n.language?.startsWith("fr") ? "fr-FR" : "en-US";

        return new Intl.DateTimeFormat(locale, {
            dateStyle: "long",
            timeStyle: "short",
        }).format(lastAuthenticationAt);
    }, [i18n.language, lastAuthenticationAt]);

    const { data: pairings } = useGetActivePairings();
    const hasPairings = (pairings?.length ?? 0) > 0;
    const { data: emailStatus } = useCurrentEmail();
    const hasEmail = emailStatus?.email != null;
    const isEmailVerified = emailStatus?.verified === true;
    const { recoverySetupStatus } = useRecoverySetupStatus();
    const { data: backendRecoveryStatus } = useRecoveryStatus();
    // Configured = enabled on-chain AND blob synced on the backend; on-chain
    // only falls back to setup so the user can finish storing the blob.
    const hasRecovery =
        !!recoverySetupStatus && !!backendRecoveryStatus?.configured;
    const recoveryExpiringSoon = recoverySetupStatus
        ? isExpiringSoon(recoverySetupStatus.validUntil)
        : false;

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="m"
            className={styles.page}
        >
            <Title size="page">{t("wallet.profile.pageTitle")}</Title>
            <ProfileIdentityCard />
            <ProfilePreferencesCard />
            <EmailSecurityCard
                hasEmail={hasEmail}
                isEmailVerified={isEmailVerified}
                hasRecovery={hasRecovery}
                recoveryExpiringSoon={recoveryExpiringSoon}
            />
            {/*<ProfileSecurityCard />*/}
            <InfoCard>
                <InfoRow
                    icon={HeartIcon}
                    label={t("wallet.referral.menuLabel")}
                    to="/profile/referral"
                />
            </InfoCard>
            {hasPairings ? (
                <InfoCard>
                    <InfoRow
                        icon={SettingsIcon}
                        label={t("wallet.profile.managePairings")}
                        to="/profile/devices"
                    />
                </InfoCard>
            ) : null}
            <ProfileLinksCard />
            <PrivateKey />
            <CrashlyticsDebug />
            {!isRunningInProd ? <MoneriumConnect /> : null}
            {/*<Logout />*/}
            <Box className={styles.footer}>
                {displayVersion ? (
                    <Text
                        variant="caption"
                        align="center"
                        color="tertiary"
                        className={styles.version}
                    >
                        Version {displayVersion}
                    </Text>
                ) : null}
                <Text variant="caption" align="center" color="tertiary">
                    FRAK Labs
                </Text>
                {formattedLastAuthentication ? (
                    <Text variant="caption" align="center" color="tertiary">
                        {t("wallet.profile.lastConnection")} :{" "}
                        {formattedLastAuthentication}
                    </Text>
                ) : null}
            </Box>
        </Box>
    );
}
