import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ConnectIcon,
    LaptopIcon,
    MobileIcon,
} from "@frak-labs/design-system/icons";
import * as styles from "./index.css";

export function PairingDevices() {
    return (
        <Inline space="m" align="center" alignY="top">
            <Stack space="xs" align="center">
                <Box className={styles.deviceIcon}>
                    <MobileIcon className={styles.deviceIconSvg} />
                </Box>
                <Text as="span" variant="caption">
                    Mobile
                </Text>
            </Stack>
            <Box className={styles.connector}>
                <ConnectIcon className={styles.connectorIcon} />
            </Box>
            <Stack space="xs" align="center">
                <Box className={styles.deviceIcon}>
                    <LaptopIcon className={styles.deviceIconSvg} />
                </Box>
                <Text as="span" variant="caption">
                    Desktop
                </Text>
            </Stack>
        </Inline>
    );
}
