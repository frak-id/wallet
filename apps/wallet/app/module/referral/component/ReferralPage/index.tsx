import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    GiftIcon,
    PencilIcon,
    ReferralIcon,
} from "@frak-labs/design-system/icons";
import { useReferralStatus } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { Title } from "@/module/common/component/Title";
import { ReferralInviteCard } from "../ReferralInviteCard";
import * as styles from "./index.css";

export function ReferralPage() {
    const { t } = useTranslation();
    const { data: status } = useReferralStatus();
    const isStatusLoaded = status !== undefined;
    const hasOwnedCode = !!status?.ownedCode;
    const redeemedCode = status?.crossMerchantReferrer?.code ?? null;
    const hasRedeemedCode = !!status?.crossMerchantReferrer;

    const modifyAction = (
        <Box className={styles.modifyAction}>
            <PencilIcon width={16} height={16} />
            <Text as="span" variant="bodySmall" weight="medium">
                {t("wallet.referral.modify")}
            </Text>
        </Box>
    );

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
                {isStatusLoaded ? (
                    <InfoCard>
                        {hasRedeemedCode ? (
                            <InfoRow
                                icon={GiftIcon}
                                label={
                                    redeemedCode ??
                                    t("wallet.referral.redeem.active")
                                }
                                to="/profile/referral/redeem"
                                action={modifyAction}
                            />
                        ) : (
                            <InfoRow
                                icon={GiftIcon}
                                label={t("wallet.referral.enterCode")}
                                to="/profile/referral/redeem"
                            />
                        )}
                    </InfoCard>
                ) : null}
            </Stack>
        </Stack>
    );
}
