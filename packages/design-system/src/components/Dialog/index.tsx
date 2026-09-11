import * as RadixDialog from "@radix-ui/react-dialog";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { Overlay } from "../Overlay";
import {
    dialogContentStyle,
    dialogDescriptionStyle,
    dialogTitleStyle,
} from "./dialog.css";

export const Dialog = RadixDialog.Root;

export const DialogTrigger = RadixDialog.Trigger;

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

export const DialogClose = RadixDialog.Close;

type DialogContentProps = ComponentPropsWithRef<typeof RadixDialog.Content> & {
    children: ReactNode;
};

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
