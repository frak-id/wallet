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
 *
 * `align`:
 * - `"center"` (default) centres the children on the bar.
 * - `"content"` lines them up over the immersive form column (gutter + 720
 *   cap), matching the edit-page layout.
 */
export function FloatingFooter({
    children,
    bare = false,
    align = "center",
    contentClassName,
}: {
    children: ReactNode;
    bare?: boolean;
    align?: "center" | "content";
    contentClassName?: string;
}) {
    return (
        <div className={clsx(styles.footer, bare && styles.footerBare)}>
            <div className={styles.scrollEdge} />
            {align === "content" ? (
                <div className={clsx(styles.contentWrapper, contentClassName)}>
                    <div className={styles.contentColumn}>{children}</div>
                </div>
            ) : (
                <div className={clsx(styles.buttonWrapper, contentClassName)}>
                    {children}
                </div>
            )}
        </div>
    );
}
