import {
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
    AlertDialogTrigger,
    AlertDialog as DSAlertDialog,
} from "@frak-labs/design-system/components/AlertDialog";
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
    button: { label, className: btnClass = "", disabled } = {},
    buttonElement,
    footer: { className: footerClass = "", after: footerAfter } = {},
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
        <DSAlertDialog
            defaultOpen={defaultOpen}
            open={open}
            onOpenChange={onOpenChange}
        >
            {label && (
                <AlertDialogTrigger asChild>
                    <button
                        type="button"
                        className={clsx(styles.trigger, btnClass)}
                        disabled={disabled}
                    >
                        {label}
                    </button>
                </AlertDialogTrigger>
            )}
            {buttonElement && (
                <AlertDialogTrigger asChild>{buttonElement}</AlertDialogTrigger>
            )}
            <AlertDialogContent
                className={clsx(
                    styles.content,
                    showCloseButton && styles.withCloseButton,
                    classNameContent
                )}
            >
                {showCloseButton && (
                    <AlertDialogCancel asChild>
                        <button
                            type="button"
                            className={styles.close}
                            aria-label="Close"
                        >
                            <X />
                        </button>
                    </AlertDialogCancel>
                )}
                {title ? (
                    <AlertDialogTitle className={classNameTitle}>
                        {title}
                    </AlertDialogTitle>
                ) : (
                    <AlertDialogTitle />
                )}
                {description ? (
                    <AlertDialogDescription asChild>
                        <div>{description}</div>
                    </AlertDialogDescription>
                ) : (
                    <AlertDialogDescription />
                )}
                {text && <div>{text}</div>}
                <div className={clsx(styles.footer, footerClass)}>
                    {cancel && (
                        <AlertDialogCancel asChild>{cancel}</AlertDialogCancel>
                    )}
                    {actionClose && action && (
                        <AlertDialogAction asChild>{action}</AlertDialogAction>
                    )}
                    {!actionClose && action}
                </div>
                {footerAfter && (
                    <div className={styles.footerAfter}>{footerAfter}</div>
                )}
            </AlertDialogContent>
        </DSAlertDialog>
    );
}
