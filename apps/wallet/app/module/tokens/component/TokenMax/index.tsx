import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./index.css";

export function TokenMax({ onClick }: { onClick: () => void }) {
    return (
        <Box display="flex" alignItems="center">
            <Button
                variant="secondary"
                className={styles.tokenMaxButton}
                onClick={onClick}
            >
                <Text as="span" variant="label">
                    MAX
                </Text>
            </Button>
        </Box>
    );
}
