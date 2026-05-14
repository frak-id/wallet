import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ComponentType, SVGProps } from "react";
import { ButtonLink } from "@/module/common/component/ButtonLink";
import * as styles from "./index.css";

type ReferralActionCardProps = {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    title: string;
    description: string;
    ctaLabel: string;
    to: string;
};

/**
 * Rich action card used on the referral hub: icon + title + description + CTA.
 */
export function ReferralActionCard({
    icon: Icon,
    title,
    description,
    ctaLabel,
    to,
}: ReferralActionCardProps) {
    return (
        <Card padding="default" variant="elevated">
            <Stack space="xs">
                <Inline space="m" alignY="top">
                    <Box className={styles.iconWrapper}>
                        <Icon />
                    </Box>
                    <Stack space="xxs" as="div" className={styles.content}>
                        <Text as="span" variant="body" weight="medium">
                            {title}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {description}
                        </Text>
                    </Stack>
                </Inline>
                <ButtonLink
                    to={to}
                    variant="secondary"
                    size="small"
                    width="full"
                >
                    {ctaLabel}
                </ButtonLink>
            </Stack>
        </Card>
    );
}
