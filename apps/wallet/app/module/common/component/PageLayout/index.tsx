import { Box } from "@frak-labs/design-system/components/Box";
import type { ReactNode } from "react";
import * as styles from "./index.css";

type PageLayoutProps = {
    children: ReactNode;
    /** Optional back affordance rendered above the content (typically a `<Back />`) */
    back?: ReactNode;
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
    footer,
    fixedViewport = false,
}: PageLayoutProps) {
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
                {back && <Box paddingLeft="m">{back}</Box>}
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
