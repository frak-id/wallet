import * as RadixDialog from "@radix-ui/react-dialog";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { Overlay } from "../Overlay";
import {
    dialogContentStyle,
    dialogDescriptionStyle,
    dialogTitleStyle,
} from "./dialog.css";

/**
 * Stateless root — pairs trigger + content.
 */
export const Dialog = RadixDialog.Root;

/**
 * Element that opens the dialog on click.
 */
export const DialogTrigger = RadixDialog.Trigger;

/**
 * Accessible title for the dialog.
 */
export function DialogTitle({
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof RadixDialog.Title>) {
    const combinedClassName = [dialogTitleStyle, className]
        .filter(Boolean)
        .join(" ");

    return (
        <RadixDialog.Title className={combinedClassName} {...props}>
            {children}
        </RadixDialog.Title>
    );
}

/**
 * Accessible description for the dialog.
 */
export function DialogDescription({
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof RadixDialog.Description>) {
    const combinedClassName = [dialogDescriptionStyle, className]
        .filter(Boolean)
        .join(" ");

    return (
        <RadixDialog.Description className={combinedClassName} {...props}>
            {children}
        </RadixDialog.Description>
    );
}

/**
 * Close button for the dialog.
 */
export const DialogClose = RadixDialog.Close;

type DialogContentProps = ComponentPropsWithRef<typeof RadixDialog.Content> & {
    children: ReactNode;
};

/**
 * Styled dialog content — portaled, animated, with overlay.
 */
export function DialogContent({
    children,
    className,
    ...props
}: DialogContentProps) {
    const combinedClassName = [dialogContentStyle, className]
        .filter(Boolean)
        .join(" ");

    return (
        <RadixDialog.Portal>
            <RadixDialog.Overlay asChild>
                <Overlay />
            </RadixDialog.Overlay>
            <RadixDialog.Content className={combinedClassName} {...props}>
                {children}
            </RadixDialog.Content>
        </RadixDialog.Portal>
    );
}
