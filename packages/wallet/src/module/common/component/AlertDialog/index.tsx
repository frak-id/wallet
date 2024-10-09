import { mergeElement } from "@module/utils/mergeElement";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./index.module.css";

type AlertDialogComponentProps = {
    title?: ReactNode;
    description?: string;
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
    closeButton?: ReactNode;
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
    footer: { className: footerClassName = "", after: footerAfter } = {},
    action,
    actionClose,
    showCloseButton = true,
    closeButton,
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
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Overlay
                    className={`${prefixModalCss("overlay")} ${styles.alertDialog__overlay}`}
                />
                <AlertDialogPrimitive.Content
                    onEscapeKeyDown={() => onOpenChange?.(false)}
                    className={`${prefixModalCss("content")} ${styles.alertDialog__content} ${
                        showCloseButton
                            ? styles.alertDialog__withCloseButton
                            : ""
                    } ${classNameContent}`}
                >
                    {showCloseButton && (
                        <AlertDialogPrimitive.Cancel asChild>
                            {closeButton ? (
                                mergeElement(closeButton, {
                                    className: `${prefixModalCss("close")} ${styles.alertDialog__close}`,
                                })
                            ) : (
                                <button
                                    type={"button"}
                                    className={`${prefixModalCss("close")} ${styles.alertDialog__close}`}
                                    aria-label="Close"
                                >
                                    <X />
                                </button>
                            )}
                        </AlertDialogPrimitive.Cancel>
                    )}
                    {title ? (
                        <AlertDialogPrimitive.Title
                            className={`${prefixModalCss("title")} ${styles.alertDialog__title} ${classNameTitle}`}
                        >
                            {title}
                        </AlertDialogPrimitive.Title>
                    ) : (
                        <AlertDialogPrimitive.Title />
                    )}
                    {description ? (
                        <AlertDialogPrimitive.Description asChild>
                            <div>{description}</div>
                        </AlertDialogPrimitive.Description>
                    ) : (
                        <AlertDialogPrimitive.Description />
                    )}
                    {text && (
                        <div
                            className={`${prefixModalCss("description")} ${styles.alertDialog__description} `}
                        >
                            {text}
                        </div>
                    )}
                    {(cancel || action) && (
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
                    )}
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
