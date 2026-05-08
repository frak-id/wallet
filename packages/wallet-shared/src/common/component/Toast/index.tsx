import { Spinner } from "@frak-labs/design-system/components/Spinner";
import type { MouseEvent, ReactNode } from "react";
import { Warning } from "../Warning";
import styles from "./index.module.css";

type ToastProps = {
    text?: string | ReactNode;
    onDismiss?: (e: MouseEvent) => void;
    ariaLabel?: string;
    ariaDismissLabel?: string;
    onClick?: (e: MouseEvent) => void;
    isLoading?: boolean;
};

export function Toast({
    text,
    onDismiss,
    ariaLabel,
    ariaDismissLabel,
    onClick,
    isLoading = false,
}: ToastProps) {
    if (isLoading) {
        return (
            <div className={styles.toast}>
                <div className={styles.toast__loading}>
                    <Spinner /> <span>{text}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.toast}>
            <ClickableComponent onClick={onClick} ariaLabel={ariaLabel}>
                <Warning text={text} className={styles.toast__warning} />
            </ClickableComponent>
            <div className={styles.toast__actions}>
                <button
                    type="button"
                    onClick={onDismiss}
                    className={styles.toast__dismissButton}
                    aria-label={ariaDismissLabel}
                >
                    <CloseIcon />
                </button>
            </div>
        </div>
    );
}

/**
 * @description This component is used to wrap the children in a button if there is an onClick prop
 * @param children - The children to wrap
 * @param onClick - The onClick prop
 * @param ariaLabel - The aria-label prop
 * @returns The wrapped children
 */
function ClickableComponent({
    children,
    onClick,
    ariaLabel,
}: {
    children: ReactNode;
    onClick?: (e: MouseEvent) => void;
    ariaLabel?: string;
}) {
    if (onClick) {
        return (
            <button
                type="button"
                className={styles.toast__clickable}
                onClick={onClick}
                aria-label={ariaLabel}
            >
                {children}
            </button>
        );
    }
    return children;
}

/**
 * Inlined `X` glyph (lucide-react geometry) so the Toast doesn't pull the
 * full lucide-react package into the eager listener bundle. The original
 * import was the only reason `ui-vendor` was statically reachable from
 * `common`, which forced the chunk into the iframe-boot preload list.
 */
function CloseIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    );
}
