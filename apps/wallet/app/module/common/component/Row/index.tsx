import { Box } from "@frak-labs/design-system/components/Box";
import type { PropsWithChildren } from "react";
import * as styles from "./index.css";

export function Row({
    withIcon,
    className = "",
    children,
}: PropsWithChildren<{ withIcon?: boolean; className?: string }>) {
    return (
        <Box
            as="p"
            className={`${styles.row} ${
                withIcon ? styles.withIcon : ""
            } ${className}`}
        >
            {children}
        </Box>
    );
}
