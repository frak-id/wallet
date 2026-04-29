import { Stack } from "@frak-labs/design-system/components/Stack";
import { GiftIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { Title } from "@/module/common/component/Title";
import { ReferralInviteCard } from "../ReferralInviteCard";

export function ReferralPage() {
    const { t } = useTranslation();

    return (
        <Stack space="m">
            <Stack space="m">
                <Back href="/profile" />
                <Title size="page">{t("wallet.referral.title")}</Title>
            </Stack>
            <Stack space="m">
                <ReferralInviteCard />
                <InfoCard>
                    <InfoRow
                        icon={GiftIcon}
                        label={t("wallet.referral.enterCode")}
                    />
                </InfoCard>
            </Stack>
        </Stack>
    );
}
