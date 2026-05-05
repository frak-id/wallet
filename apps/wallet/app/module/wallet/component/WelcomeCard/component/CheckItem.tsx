import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import * as styles from "../index.css";

export function CheckItem({ text }: { text: string }) {
    return (
        <Box className={styles.checkItem}>
            <Box className={styles.checkItemIcon}>
                <CheckIcon width={12} height={12} color={vars.text.action} />
            </Box>
            <Text variant="caption" color="secondary">
                {text}
            </Text>
        </Box>
    );
}
