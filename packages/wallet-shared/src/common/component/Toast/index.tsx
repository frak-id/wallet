import { Spinner } from "@frak-labs/ui/component/Spinner";
import { Warning } from "@frak-labs/wallet-shared/common/component/Warning";
import { X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
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
                    <X size={16} />
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
