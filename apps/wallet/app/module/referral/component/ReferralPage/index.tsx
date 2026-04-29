import { Stack } from "@frak-labs/design-system/components/Stack";
import { GiftIcon, ReferralIcon } from "@frak-labs/design-system/icons";
import { useReferralStatus } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { Title } from "@/module/common/component/Title";
import { ReferralInviteCard } from "../ReferralInviteCard";

export function ReferralPage() {
    const { t } = useTranslation();
    const { data: status } = useReferralStatus();
    const isStatusLoaded = status !== undefined;
    const hasOwnedCode = !!status?.ownedCode;

    return (
        <Stack space="m">
            <Stack space="m">
                <Back href="/profile" />
                <Title size="page">{t("wallet.referral.title")}</Title>
            </Stack>
            <Stack space="m">
                {isStatusLoaded ? (
                    hasOwnedCode ? (
                        <InfoCard>
                            <InfoRow
                                icon={ReferralIcon}
                                label={t("wallet.referral.invite.title")}
                                to="/profile/referral/share"
                            />
                        </InfoCard>
                    ) : (
                        <ReferralInviteCard />
                    )
                ) : null}
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
