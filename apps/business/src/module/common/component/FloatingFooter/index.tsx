import clsx from "clsx";
import type { ReactNode } from "react";
import * as styles from "./floating-footer.css";

/**
 * Floating bottom bar pinned to the viewport, with a scroll-edge blur so
 * content scrolling underneath stays readable. Pair with the
 * `pageBottomSpacer` style on the page wrapper.
 *
 * `bare` spans the full viewport width — for pages rendered without the
 * app shell (no navigation sidebar to offset).
 */
export function FloatingFooter({
    children,
    bare = false,
    contentClassName,
}: {
    children: ReactNode;
    bare?: boolean;
    contentClassName?: string;
}) {
    return (
        <div className={clsx(styles.footer, bare && styles.footerBare)}>
            <div className={styles.scrollEdge} />
            <div className={clsx(styles.buttonWrapper, contentClassName)}>
                {children}
            </div>
        </div>
    );
}
