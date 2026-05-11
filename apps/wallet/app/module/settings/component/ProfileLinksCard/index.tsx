import {
    DocumentIcon,
    EyeIcon,
    HelpChatIcon,
    StarIcon,
} from "@frak-labs/design-system/icons";
import { getRateAppUrl } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";

export function ProfileLinksCard() {
    const { t } = useTranslation();
    const rateUrl = getRateAppUrl();

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
                    href="https://frak.id/terms"
                />
            </InfoCard>
            <InfoCard>
                <InfoRow
                    icon={HelpChatIcon}
                    label={t("wallet.profile.helpSupport", "Help & support")}
                    href="mailto:hello@frak.id"
                />
            </InfoCard>
            {rateUrl ? (
                <InfoCard>
                    <InfoRow
                        icon={StarIcon}
                        label={t("wallet.profile.rateApp", "Rate the app")}
                        href={rateUrl}
                    />
                </InfoCard>
            ) : null}
        </>
    );
}
