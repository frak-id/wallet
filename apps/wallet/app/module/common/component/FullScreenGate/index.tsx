import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./index.css";

type FullScreenGateProps = {
    title: string;
    /** Body text under the title. Use one or more `<Text variant="bodySmall">`. */
    description?: ReactNode;
    /** Action slot (typically a `<Button>`). */
    action: ReactNode;
};

/**
 * Fullscreen blocking screen used by `BiometricLock`, `HardUpdateGate`, and
 * the router error boundary. Content sits centered, action pins to the
 * bottom edge full-width — same layout shape as the wallet's modals so it
 * doesn't feel like a different surface.
 */
export function FullScreenGate({
    title,
    description,
    action,
}: FullScreenGateProps) {
    return (
        <Box className={styles.gate}>
            <Box className={styles.content}>
                <Text variant="heading2" align="center">
                    {title}
                </Text>
                {description && (
                    <Box className={styles.description}>{description}</Box>
                )}
            </Box>
            <Box className={styles.actions}>{action}</Box>
        </Box>
    );
}
