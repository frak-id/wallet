import {
    type CSSProperties,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";
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
    const footerRef = useRef<HTMLDivElement>(null);
    const [footerHeight, setFooterHeight] = useState(0);
    const hasFooter = Boolean(footer);

    // Feed the footer height to `--footer-height` (content padding + footer
    // negative margin). It varies per screen, so measure rather than hardcode.
    useEffect(() => {
        if (!fixedViewport || !hasFooter) return;
        const el = footerRef.current;
        if (!el) return;
        const measure = () => setFooterHeight(el.offsetHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [fixedViewport, hasFooter]);

    return (
        <div
            className={styles.container}
            style={
                fixedViewport
                    ? ({
                          "--footer-height": `${footerHeight}px`,
                      } as CSSProperties)
                    : undefined
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
            {footer &&
                (fixedViewport ? (
                    <div ref={footerRef} className={styles.footerSticky}>
                        <div className={styles.footerBlur} aria-hidden="true" />
                        <div
                            className={`${styles.footer} ${styles.footerFixed}`}
                        >
                            {footer}
                        </div>
                    </div>
                ) : (
                    <div className={styles.footer}>{footer}</div>
                ))}
        </div>
    );
}
