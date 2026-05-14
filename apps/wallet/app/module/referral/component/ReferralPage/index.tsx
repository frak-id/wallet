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
import { ReferralActionCard } from "../ReferralActionCard";
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
                        <ReferralActionCard
                            icon={ReferralIcon}
                            title={t("wallet.referral.invite.title")}
                            description={t(
                                "wallet.referral.invite.description"
                            )}
                            ctaLabel={t("wallet.referral.invite.cta")}
                            to="/profile/referral/create"
                        />
                    )
                ) : null}
                {isStatusLoaded ? (
                    hasRedeemedCode ? (
                        <InfoCard>
                            <InfoRow
                                icon={GiftIcon}
                                label={
                                    redeemedCode ??
                                    t("wallet.referral.redeem.active")
                                }
                                to="/profile/referral/redeem"
                                action={modifyAction}
                            />
                        </InfoCard>
                    ) : (
                        <ReferralActionCard
                            icon={GiftIcon}
                            title={t("wallet.referral.enterCode.title")}
                            description={t(
                                "wallet.referral.enterCode.description"
                            )}
                            ctaLabel={t("wallet.referral.enterCode.cta")}
                            to="/profile/referral/redeem"
                        />
                    )
                ) : null}
            </Stack>
        </Stack>
    );
}
