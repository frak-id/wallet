import {
    DocumentIcon,
    EyeIcon,
    HelpChatIcon,
    StarIcon,
} from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import {
    SettingsCard,
    SettingsRow,
} from "@/module/settings/component/SettingsCard";

export function ProfileLinksCard() {
    const { t } = useTranslation();

    return (
        <>
            <SettingsCard>
                <SettingsRow
                    icon={EyeIcon}
                    label={t("wallet.profile.privacyPolicy", "Privacy policy")}
                    href="https://frak.id/privacy"
                />
                <SettingsRow
                    icon={DocumentIcon}
                    label={t("wallet.settings.termsOfUse", "Terms of Use")}
                    href="https://frak.id/privacy"
                />
            </SettingsCard>
            <SettingsCard>
                <SettingsRow
                    icon={HelpChatIcon}
                    label={t("wallet.profile.helpSupport", "Help & support")}
                    href="mailto:hello@frak.id"
                />
            </SettingsCard>
            <SettingsCard>
                <SettingsRow
                    icon={StarIcon}
                    label={t("wallet.profile.rateApp", "Rate the app")}
                    href="https://frak.id/rate"
                />
            </SettingsCard>
        </>
    );
}
