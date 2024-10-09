import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export type AlertDialogComponentProps = {
    title?: ReactNode | string;
    description?: string | ReactNode;
    text?: ReactNode | string;
    button?: {
        label?: ReactNode | string;
        className?: string;
        disabled?: boolean;
    };
    buttonElement?: ReactNode;
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
    classNameTitle?: string;
};

export function AlertDialog({
    title,
    description,
    text,
    button: { label, className = "", disabled } = {},
    buttonElement,
    footer: { className: footerClassName = "", after: footerAfter } = {},
    action,
    actionClose = false,
    showCloseButton = true,
    cancel,
    defaultOpen = false,
    open,
    onOpenChange,
    classNameContent = "",
    classNameTitle = "",
}: AlertDialogComponentProps) {
    return (
        <AlertDialogPrimitive.Root
            defaultOpen={defaultOpen}
            open={open}
            onOpenChange={onOpenChange}
        >
            {label && (
                <AlertDialogPrimitive.Trigger asChild>
                    {label && (
                        <button
                            type={"button"}
                            className={`${styles.alertDialog__trigger} ${className}`}
                            disabled={disabled}
                        >
                            {label}
                        </button>
                    )}
                </AlertDialogPrimitive.Trigger>
            )}
            {buttonElement && (
                <AlertDialogPrimitive.Trigger asChild>
                    {buttonElement}
                </AlertDialogPrimitive.Trigger>
            )}
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Overlay
                    className={styles.alertDialog__overlay}
                />
                <AlertDialogPrimitive.Content
                    onEscapeKeyDown={() => onOpenChange?.(false)}
                    className={`${styles.alertDialog__content} ${
                        showCloseButton ? styles.withCloseButton : ""
                    } ${classNameContent}`}
                >
                    {showCloseButton && (
                        <AlertDialogPrimitive.Cancel asChild>
                            <button
                                type={"button"}
                                className={styles.alertDialog__close}
                                aria-label="Close"
                            >
                                <X />
                            </button>
                        </AlertDialogPrimitive.Cancel>
                    )}
                    {title ? (
                        <AlertDialogPrimitive.Title
                            className={`${styles.alertDialog__title} ${classNameTitle}`}
                        >
                            {title}
                        </AlertDialogPrimitive.Title>
                    ) : (
                        <AlertDialogPrimitive.Title />
                    )}
                    {description ? (
                        <AlertDialogPrimitive.Description
                            asChild
                            className={styles.alertDialog__description}
                        >
                            <div>{description}</div>
                        </AlertDialogPrimitive.Description>
                    ) : (
                        <AlertDialogPrimitive.Description />
                    )}
                    {text && (
                        <div className={styles.alertDialog__text}>{text}</div>
                    )}
                    <div
                        className={`${styles.alertDialog__footer} ${footerClassName}`}
                    >
                        <AlertDialogPrimitive.Cancel asChild>
                            {cancel}
                        </AlertDialogPrimitive.Cancel>
                        {actionClose && (
                            <AlertDialogPrimitive.Action asChild>
                                {action}
                            </AlertDialogPrimitive.Action>
                        )}
                        {!actionClose && action}
                    </div>
                    {footerAfter && (
                        <div className={styles.alertDialog__footerAfter}>
                            {footerAfter}
                        </div>
                    )}
                </AlertDialogPrimitive.Content>
            </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
    );
}
