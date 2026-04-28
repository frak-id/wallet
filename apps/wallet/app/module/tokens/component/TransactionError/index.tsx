import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./index.css";

export function TransactionError({ message }: { message: string }) {
    return (
        <Box className={styles.errorPanel}>
            <Text variant="bodySmall" color="error">
                {message}
            </Text>
        </Box>
    );
}
