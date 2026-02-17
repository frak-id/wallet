import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

interface EmptyStateAction {
    content: string;
    onAction: () => void;
}

interface EmptyStateProps {
    heading: string;
    action?: EmptyStateAction;
    footerContent?: ReactNode;
    image?: string;
    children?: ReactNode;
}

export function EmptyState({
    heading,
    action,
    footerContent,
    image,
    children,
}: EmptyStateProps) {
    return (
        <div className={styles.emptyState}>
            {image && (
                <div className={styles.imageContainer}>
                    <img src={image} alt="" className={styles.image} />
                </div>
            )}
            <h2 className={styles.heading}>{heading}</h2>
            {children && <div className={styles.children}>{children}</div>}
            {action && (
                <s-button variant="primary" onClick={action.onAction}>
                    {action.content}
                </s-button>
            )}
            {footerContent && (
                <div className={styles.footer}>{footerContent}</div>
            )}
        </div>
    );
}
