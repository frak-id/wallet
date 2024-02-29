import * as AlertDialogRadix from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./index.module.css";

type AlertDialogComponentProps = {
    title?: string;
    text?: ReactNode | string;
    button?: {
        label?: ReactNode | string;
        className?: string;
        disabled?: boolean;
    };
    footer?: { className?: string; after?: ReactNode };
    onSuccess?: () => void;
    action?: ReactNode;
    actionClose?: boolean;
    showCloseButton?: boolean;
    cancel?: ReactNode;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    classNameContent?: string;
};

export function AlertDialog({
    title,
    text,
    button: { label, className = "", disabled } = {},
    footer: { className: footerClassName = "", after: footerAfter } = {},
    action,
    actionClose,
    showCloseButton = true,
    cancel,
    defaultOpen = false,
    open,
    onOpenChange,
    classNameContent = "",
}: AlertDialogComponentProps) {
    return (
        <AlertDialogRadix.Root
            defaultOpen={defaultOpen}
            open={open}
            onOpenChange={onOpenChange}
        >
            <AlertDialogRadix.Trigger asChild>
                {label && (
                    <button
                        type={"button"}
                        className={`${styles.alertDialog__trigger} ${className}`}
                        disabled={disabled}
                    >
                        {label}
                    </button>
                )}
            </AlertDialogRadix.Trigger>
            <AlertDialogRadix.Portal>
                <AlertDialogRadix.Overlay
                    className={styles.alertDialog__overlay}
                />
                <AlertDialogRadix.Content
                    className={`${styles.alertDialog__content} ${
                        showCloseButton ? styles.withCloseButton : ""
                    } ${classNameContent}`}
                >
                    {showCloseButton && (
                        <AlertDialogRadix.Cancel asChild>
                            <button
                                type={"button"}
                                className={styles.alertDialog__close}
                                aria-label="Close"
                            >
                                <X />
                            </button>
                        </AlertDialogRadix.Cancel>
                    )}
                    {title && (
                        <AlertDialogRadix.Title
                            className={styles.alertDialog__title}
                        >
                            {title}
                        </AlertDialogRadix.Title>
                    )}
                    {text && (
                        <AlertDialogRadix.Description
                            className={styles.alertDialog__description}
                            asChild
                        >
                            {text}
                        </AlertDialogRadix.Description>
                    )}
                    <div
                        className={`${styles.alertDialog__footer} ${footerClassName}`}
                    >
                        <AlertDialogRadix.Cancel asChild>
                            {cancel}
                        </AlertDialogRadix.Cancel>
                        {actionClose && (
                            <AlertDialogRadix.Action asChild>
                                {action}
                            </AlertDialogRadix.Action>
                        )}
                        {!actionClose && action}
                    </div>
                    {footerAfter && (
                        <div className={styles.alertDialog__footerAfter}>
                            {footerAfter}
                        </div>
                    )}
                </AlertDialogRadix.Content>
            </AlertDialogRadix.Portal>
        </AlertDialogRadix.Root>
    );
}
