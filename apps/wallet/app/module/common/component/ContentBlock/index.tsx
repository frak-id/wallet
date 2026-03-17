import type { ReactNode } from "react";
import styles from "./index.module.css";

type ContentBlockProps = {
    icon: ReactNode;
    title: ReactNode;
    description: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    /** Heading level for the title element (default: "h2") */
    titleAs?: "h1" | "h2" | "h3";
};

/**
 * Shared centered content pattern: icon circle + title + description + optional footer.
 *
 * Renders as a Fragment — wrap in a layout component (Box, StepLayout, etc.) for spacing.
 */
export function ContentBlock({
    icon,
    title,
    description,
    footer,
    children,
    titleAs: TitleTag = "h2",
}: ContentBlockProps) {
    return (
        <>
            <div className={styles.contentBlock__icon}>{icon}</div>
            <TitleTag className={styles.contentBlock__title}>{title}</TitleTag>
            <p className={styles.contentBlock__description}>{description}</p>
            {children}
            {footer && (
                <div className={styles.contentBlock__footer}>{footer}</div>
            )}
        </>
    );
}
