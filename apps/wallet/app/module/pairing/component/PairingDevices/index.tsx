import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { Laptop, Smartphone } from "lucide-react";
import * as styles from "./index.css";

export function PairingDevices() {
    return (
        <Box className={styles.devices}>
            <Box className={styles.device}>
                <Box className={styles.deviceIcon}>
                    <Smartphone className={styles.deviceIconSvg} />
                </Box>
                <Text as="span" variant="caption">
                    Mobile
                </Text>
            </Box>
            <Box className={styles.connector} />
            <Box className={styles.device}>
                <Box className={styles.deviceIcon}>
                    <Laptop className={styles.deviceIconSvg} />
                </Box>
                <Text as="span" variant="caption">
                    Desktop
                </Text>
            </Box>
        </Box>
    );
}
