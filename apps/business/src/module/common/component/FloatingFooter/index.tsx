import type { ReactNode } from "react";
import * as styles from "./floating-footer.css";

/**
 * Floating bottom bar pinned to the viewport, with a scroll-edge blur so
 * content scrolling underneath stays readable. Pair with the
 * `pageBottomSpacer` style on the page wrapper.
 */
export function FloatingFooter({ children }: { children: ReactNode }) {
    return (
        <div className={styles.footer}>
            <div className={styles.scrollEdge} />
            <div className={styles.buttonWrapper}>{children}</div>
        </div>
    );
}
