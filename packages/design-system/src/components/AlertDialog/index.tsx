import * as RadixAlertDialog from "@radix-ui/react-alert-dialog";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { Overlay } from "../Overlay";
import {
    alertDialogContentStyle,
    alertDialogDescriptionStyle,
    alertDialogTitleStyle,
} from "./alertDialog.css";

/**
 * Stateless root — pairs trigger + content.
 */
export const AlertDialog = RadixAlertDialog.Root;

/**
 * Element that opens the alert dialog on click.
 */
export const AlertDialogTrigger = RadixAlertDialog.Trigger;

/**
 * Accessible title for the alert dialog.
 */
export function AlertDialogTitle({
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof RadixAlertDialog.Title>) {
    const combinedClassName = [alertDialogTitleStyle, className]
        .filter(Boolean)
        .join(" ");

    return (
        <RadixAlertDialog.Title className={combinedClassName} {...props}>
            {children}
        </RadixAlertDialog.Title>
    );
}

/**
 * Accessible description for the alert dialog.
 */
export function AlertDialogDescription({
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof RadixAlertDialog.Description>) {
    const combinedClassName = [alertDialogDescriptionStyle, className]
        .filter(Boolean)
        .join(" ");

    return (
        <RadixAlertDialog.Description className={combinedClassName} {...props}>
            {children}
        </RadixAlertDialog.Description>
    );
}

/**
 * Confirms the alert dialog action.
 */
export const AlertDialogAction = RadixAlertDialog.Action;

/**
 * Cancels the alert dialog.
 */
export const AlertDialogCancel = RadixAlertDialog.Cancel;

type AlertDialogContentProps = ComponentPropsWithRef<
    typeof RadixAlertDialog.Content
> & {
    children: ReactNode;
};

/**
 * Styled alert dialog content — portaled, animated, with overlay.
 */
export function AlertDialogContent({
    children,
    className,
    ...props
}: AlertDialogContentProps) {
    const combinedClassName = [alertDialogContentStyle, className]
        .filter(Boolean)
        .join(" ");

    return (
        <RadixAlertDialog.Portal>
            <RadixAlertDialog.Overlay asChild>
                <Overlay />
            </RadixAlertDialog.Overlay>
            <RadixAlertDialog.Content className={combinedClassName} {...props}>
                {children}
            </RadixAlertDialog.Content>
        </RadixAlertDialog.Portal>
    );
}
