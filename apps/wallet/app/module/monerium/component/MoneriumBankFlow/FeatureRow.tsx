import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./index.css";

type FeatureRowProps = {
    icon: ReactNode;
    title: string;
    description: string;
};

/**
 * A row displaying an icon circle, a bold title, and a description.
 * Used across all Monerium onboarding screens.
 */
export function FeatureRow({ icon, title, description }: FeatureRowProps) {
    return (
        <Box display={"flex"} alignItems={"flex-start"} gap={"m"}>
            <Box className={styles.featureIcon}>{icon}</Box>
            <Box
                display={"flex"}
                flexDirection={"column"}
                gap={"xxs"}
                flexGrow={1}
            >
                <Text variant="bodySmall" weight="bold">
                    {title}
                </Text>
                <Text variant="caption" color="secondary">
                    {description}
                </Text>
            </Box>
        </Box>
    );
}
