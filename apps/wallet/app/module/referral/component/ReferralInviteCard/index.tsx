import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ReferralIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { ButtonLink } from "@/module/common/component/ButtonLink";
import * as styles from "./index.css";

/**
 * Rich invite card shown on the hub when the user has no code yet:
 * icon + title + description + "Générer mon code" CTA → /create.
 */
export function ReferralInviteCard() {
    const { t } = useTranslation();

    return (
        <Card padding="default" variant="elevated">
            <Stack space="xs">
                <Inline space="m" alignY="top">
                    <Box className={styles.iconWrapper}>
                        <ReferralIcon />
                    </Box>
                    <Stack space="xxs" as="div" className={styles.content}>
                        <Text as="span" variant="body" weight="medium">
                            {t("wallet.referral.invite.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.referral.invite.description")}
                        </Text>
                    </Stack>
                </Inline>
                <ButtonLink
                    to="/profile/referral/create"
                    variant="secondary"
                    size="small"
                    width="full"
                >
                    {t("wallet.referral.invite.cta")}
                </ButtonLink>
            </Stack>
        </Card>
    );
}
