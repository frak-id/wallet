import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import clsx from "clsx";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import * as styles from "./alert-dialog.css";

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
                    <button
                        type="button"
                        className={clsx(styles.trigger, className)}
                        disabled={disabled}
                    >
                        {label}
                    </button>
                </AlertDialogPrimitive.Trigger>
            )}
            {buttonElement && (
                <AlertDialogPrimitive.Trigger asChild>
                    {buttonElement}
                </AlertDialogPrimitive.Trigger>
            )}
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Overlay
                    onClick={() => onOpenChange?.(false)}
                    className={styles.overlay}
                />
                <AlertDialogPrimitive.Content
                    onEscapeKeyDown={() => onOpenChange?.(false)}
                    className={clsx(
                        styles.content,
                        showCloseButton && styles.withCloseButton,
                        classNameContent
                    )}
                >
                    {showCloseButton && (
                        <AlertDialogPrimitive.Cancel asChild>
                            <button
                                type="button"
                                className={styles.close}
                                aria-label="Close"
                            >
                                <X />
                            </button>
                        </AlertDialogPrimitive.Cancel>
                    )}
                    {title ? (
                        <AlertDialogPrimitive.Title
                            className={clsx(styles.title, classNameTitle)}
                        >
                            {title}
                        </AlertDialogPrimitive.Title>
                    ) : (
                        <AlertDialogPrimitive.Title />
                    )}
                    {description ? (
                        <AlertDialogPrimitive.Description
                            asChild
                            className={styles.description}
                        >
                            <div>{description}</div>
                        </AlertDialogPrimitive.Description>
                    ) : (
                        <AlertDialogPrimitive.Description />
                    )}
                    {text && <div>{text}</div>}
                    <div className={clsx(styles.footer, footerClassName)}>
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
                        <div className={styles.footerAfter}>{footerAfter}</div>
                    )}
                </AlertDialogPrimitive.Content>
            </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
    );
}
