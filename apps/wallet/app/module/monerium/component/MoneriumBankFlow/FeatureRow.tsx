import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./index.css";

type FeatureRowProps = {
    icon: ReactNode;
    title: string;
    description: string;
};

export function FeatureRow({ icon, title, description }: FeatureRowProps) {
    return (
        <Box className={styles.featureCell}>
            <Inline space="m" alignY="top" wrap={false}>
                <Box className={styles.featureIconSlot}>{icon}</Box>
                <Stack space="xxs">
                    <Text variant="body" weight="medium">
                        {title}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {description}
                    </Text>
                </Stack>
            </Inline>
        </Box>
    );
}

export function FeatureList({ features }: { features: FeatureRowProps[] }) {
    if (features.length === 0) return null;
    return (
        <Card variant="elevated" padding="none">
            <Stack space="none">
                {features.map((feature) => (
                    <FeatureRow key={feature.title} {...feature} />
                ))}
            </Stack>
        </Card>
    );
}
