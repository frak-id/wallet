import {
    DocumentIcon,
    EyeIcon,
    HelpChatIcon,
    StarIcon,
} from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";

export function ProfileLinksCard() {
    const { t } = useTranslation();

    return (
        <>
            <InfoCard>
                <InfoRow
                    icon={EyeIcon}
                    label={t("wallet.profile.privacyPolicy", "Privacy policy")}
                    href="https://frak.id/privacy"
                />
                <InfoRow
                    icon={DocumentIcon}
                    label={t("wallet.settings.termsOfUse", "Terms of Use")}
                    href="https://frak.id/privacy"
                />
            </InfoCard>
            <InfoCard>
                <InfoRow
                    icon={HelpChatIcon}
                    label={t("wallet.profile.helpSupport", "Help & support")}
                    href="mailto:hello@frak.id"
                />
            </InfoCard>
            <InfoCard>
                <InfoRow
                    icon={StarIcon}
                    label={t("wallet.profile.rateApp", "Rate the app")}
                    href="https://frak.id/rate"
                />
            </InfoCard>
        </>
    );
}
