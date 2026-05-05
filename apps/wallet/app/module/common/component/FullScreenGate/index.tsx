import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { LogoFrakWithName } from "@frak-labs/wallet-shared";
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
 * Fullscreen blocking screen with the brand gradient + logo.
 *
 * Shared by `BiometricLock` and `HardUpdateGate` — both render the same
 * "you can't proceed until this resolves" UX, so the layout, gradient and
 * logo sizing live here once.
 */
export function FullScreenGate({
    title,
    description,
    action,
}: FullScreenGateProps) {
    return (
        <Box
            padding="l"
            gap="xl"
            className={styles.gate}
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
        >
            <LogoFrakWithName className={styles.logo} />
            <Box flexDirection="column" alignItems="center" gap="m">
                <Text variant="heading1">{title}</Text>
                {description}
            </Box>
            {action}
        </Box>
    );
}
