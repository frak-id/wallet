import type { ReactNode } from "react";
import * as styles from "../../styles/bannerStack.css";
import { Box } from "../Box";

/** Marks the stack so native chrome (iOS glass toolbars) can step aside while a banner shows. */
export const BANNER_STACK_ATTRIBUTE = "data-banner-stack";

type BannerStackProps = {
    children?: ReactNode;
};

/**
 * Pins status banners (`OfflineBanner`, `PairingInProgress`, ...) to the top,
 * stacked with a gap. Owns safe-area inset and z-index. Always mounted —
 * children own visibility and the stack is `pointer-events: none` when empty.
 */
export function BannerStack({ children }: BannerStackProps) {
    return (
        <Box
            className={styles.stack}
            {...{ [BANNER_STACK_ATTRIBUTE]: "" }}
            // Keep a banner click from reaching the modal's outside-dismiss
            // listener (the stack renders outside modal content). Click still fires.
            onPointerDown={(event) => event.nativeEvent.stopPropagation()}
        >
            {children}
        </Box>
    );
}
