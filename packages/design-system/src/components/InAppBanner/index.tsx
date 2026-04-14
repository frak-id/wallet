import { CloseCircleIcon, ExternalLinkIcon, WarningIcon } from "../../icons";
import * as styles from "../../styles/inAppBanner.css";

type InAppBannerProps = {
    title: string;
    description: string;
    cta: string;
    dismissLabel: string;
    onAction: () => void;
    onDismiss: () => void;
    /** Extra class(es) appended to the root container. */
    className?: string;
    /** Per-slot extra classes (used by the SDK for BEM targeting). */
    classNames?: {
        icon?: string;
        title?: string;
        description?: string;
        cta?: string;
        close?: string;
    };
};

export function InAppBanner({
    title,
    description,
    cta,
    dismissLabel,
    onAction,
    onDismiss,
    className,
    classNames,
}: InAppBannerProps) {
    return (
        <div
            className={`${styles.container}${className ? ` ${className}` : ""}`}
            role="alert"
        >
            <div className={styles.header}>
                <span
                    className={`${styles.iconWrapper}${classNames?.icon ? ` ${classNames.icon}` : ""}`}
                >
                    <WarningIcon width={20} height={20} />
                </span>
                <p
                    className={`${styles.title}${classNames?.title ? ` ${classNames.title}` : ""}`}
                >
                    {title}
                </p>
            </div>
            <div className={styles.body}>
                <p
                    className={`${styles.description}${classNames?.description ? ` ${classNames.description}` : ""}`}
                >
                    {description}
                </p>
                <button
                    type="button"
                    className={`${styles.cta}${classNames?.cta ? ` ${classNames.cta}` : ""}`}
                    onClick={onAction}
                >
                    {cta}
                    <ExternalLinkIcon width={14} height={14} />
                </button>
            </div>
            <button
                type="button"
                className={`${styles.closeButton}${classNames?.close ? ` ${classNames.close}` : ""}`}
                onClick={onDismiss}
                aria-label={dismissLabel}
            >
                <CloseCircleIcon width={16} height={16} />
            </button>
        </div>
    );
}
