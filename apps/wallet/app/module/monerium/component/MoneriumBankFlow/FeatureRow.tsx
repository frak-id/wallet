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
 * A row displaying a filled icon next to a bold title and a description,
 * rendered flush inside the enclosing elevated card.
 */
export function FeatureRow({ icon, title, description }: FeatureRowProps) {
    return (
        <Box className={styles.featureCell}>
            <Box className={styles.featureIconSlot}>{icon}</Box>
            <Box
                display={"flex"}
                flexDirection={"column"}
                gap={"xxs"}
                flexGrow={1}
            >
                <Text variant="body" weight="medium">
                    {title}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {description}
                </Text>
            </Box>
        </Box>
    );
}
