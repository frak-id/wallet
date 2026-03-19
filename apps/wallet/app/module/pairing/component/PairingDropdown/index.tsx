import { Box } from "@frak-labs/design-system/components/Box";
import type { PropsWithChildren } from "react";
import * as styles from "./index.css";

export function PairingDropdown({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <Box
            className={[styles.pairingDropdown, className]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </Box>
    );
}
