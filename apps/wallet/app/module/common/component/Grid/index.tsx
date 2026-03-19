import { Box } from "@frak-labs/design-system/components/Box";
import type { PropsWithChildren, ReactNode } from "react";
import * as styles from "./index.css";

export function Grid({
    children,
    footer,
    className = "",
}: PropsWithChildren<{ footer?: ReactNode; className?: string }>) {
    return (
        <Box className={`${styles.grid} ${className}`}>
            <Box>{children}</Box>
            {footer && <Box>{footer}</Box>}
        </Box>
    );
}
