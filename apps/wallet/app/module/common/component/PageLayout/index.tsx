import type { ReactNode } from "react";
import * as styles from "./index.css";

type PageLayoutProps = {
    children: ReactNode;
    /** Optional back affordance rendered on the left of the header row (typically a `<Back />`) */
    back?: ReactNode;
    /**
     * Optional content rendered centered on the same row as the back button.
     * Used for lightweight breadcrumbs / step indicators in multi-step flows.
     */
    headerCenter?: ReactNode;
    /** Optional content rendered right-aligned on the header row. */
    headerEnd?: ReactNode;
    /** Bottom-pinned footer content (buttons, actions) */
    footer?: ReactNode;
    /**
     * Pin the layout to the viewport: content cannot scroll, children must
     * shrink to fit. Used by onboarding screens so the footer CTA stays in
     * view above the home indicator on small phones.
     */
    fixedViewport?: boolean;
};

export function PageLayout({
    children,
    back,
    headerCenter,
    headerEnd,
    footer,
    fixedViewport = false,
}: PageLayoutProps) {
    const showHeader = Boolean(back || headerCenter || headerEnd);
    return (
        <div
            className={
                fixedViewport
                    ? `${styles.container} ${styles.containerFixed}`
                    : styles.container
            }
        >
            <div
                className={
                    fixedViewport
                        ? `${styles.content} ${styles.contentFixed}`
                        : styles.content
                }
            >
                {showHeader && (
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>{back}</div>
                        <div className={styles.headerCenter}>
                            {headerCenter}
                        </div>
                        <div className={styles.headerEnd}>{headerEnd}</div>
                    </div>
                )}
                {children}
            </div>
            {footer && (
                <div
                    className={
                        fixedViewport
                            ? `${styles.footer} ${styles.footerFixed}`
                            : styles.footer
                    }
                >
                    {footer}
                </div>
            )}
        </div>
    );
}
