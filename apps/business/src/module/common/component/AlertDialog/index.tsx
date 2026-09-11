import {
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
import { useTranslation } from "react-i18next";
import * as styles from "./alert-dialog.css";

export type AlertDialogComponentProps = {
    title?: ReactNode | string;
    description?: string | ReactNode;
    text?: ReactNode | string;
    buttonElement?: ReactNode;
    action?: ReactNode;
    cancel?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export function AlertDialog({
    title,
    description,
    text,
    buttonElement,
    action,
    cancel,
    open,
    onOpenChange,
}: AlertDialogComponentProps) {
    const { t } = useTranslation();
    return (
        <DSAlertDialog open={open} onOpenChange={onOpenChange}>
            {buttonElement && (
                <AlertDialogTrigger asChild>{buttonElement}</AlertDialogTrigger>
            )}
            <AlertDialogContent
                className={clsx(styles.content, styles.withCloseButton)}
            >
                <AlertDialogCancel asChild>
                    <button
                        type="button"
                        className={styles.close}
                        aria-label={t("common.close")}
                    >
                        <X />
                    </button>
                </AlertDialogCancel>
                {/* Radix requires a title and a description node even when empty */}
                {title ? (
                    <AlertDialogTitle>{title}</AlertDialogTitle>
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
                <div className={styles.footer}>
                    {cancel && (
                        <AlertDialogCancel asChild>{cancel}</AlertDialogCancel>
                    )}
                    {action}
                </div>
            </AlertDialogContent>
        </DSAlertDialog>
    );
}
