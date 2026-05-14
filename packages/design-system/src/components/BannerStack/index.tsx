import type { ReactNode } from "react";
import * as styles from "../../styles/bannerStack.css";
import { Box } from "../Box";

type BannerStackProps = {
    children?: ReactNode;
};

/**
 * Fixed-position container that pins one or more status banners
 * (e.g. `OfflineBanner`, `PairingInProgress`) to the top of the viewport,
 * stacking them vertically with a consistent gap. Owns safe-area inset
 * and z-index so individual banners can stay positioning-agnostic.
 *
 * The container is always mounted (the children own their own visibility
 * via conditional `null` returns) — since it's `pointer-events: none` and
 * has no visible styling, an empty stack has no UI or interaction impact.
 */
export function BannerStack({ children }: BannerStackProps) {
    return <Box className={styles.stack}>{children}</Box>;
}
