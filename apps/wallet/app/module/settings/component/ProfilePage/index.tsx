import { isRunningInProd } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { HeartIcon, SettingsIcon } from "@frak-labs/design-system/icons";
import {
    authenticationStore,
    selectLastAuthenticationAt,
    useGetActivePairings,
} from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { Title } from "@/module/common/component/Title";
// import { Logout } from "@/module/authentication/component/Logout";
import { MoneriumConnect } from "@/module/monerium/component/MoneriumConnect";
import { PrivateKey } from "@/module/settings/component/PrivateKey";
import { ProfileIdentityCard } from "@/module/settings/component/ProfileIdentityCard";
import { ProfileLinksCard } from "@/module/settings/component/ProfileLinksCard";
import { ProfilePreferencesCard } from "@/module/settings/component/ProfilePreferencesCard";
// import { ProfileSecurityCard } from "@/module/settings/component/ProfileSecurityCard";
import * as styles from "./index.css";

export function ProfilePage() {
    const { t, i18n } = useTranslation();
    const version = process.env.APP_VERSION;
    const displayVersion =
        version && version !== "UNKNOWN" ? version : undefined;
    const lastAuthenticationAt = authenticationStore(
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
