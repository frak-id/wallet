import { Box } from "@frak-labs/design-system/components/Box";
import type { PropsWithChildren } from "react";
import * as styles from "./index.css";

export function ButtonLabel({ children }: PropsWithChildren) {
    return (
        <Box as="span" className={styles.buttonLabel}>
            {children}
        </Box>
    );
}
