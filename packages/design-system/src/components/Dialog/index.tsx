import * as RadixDialog from "@radix-ui/react-dialog";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { Overlay } from "../Overlay";
import {
    dialogContent,
    dialogDescriptionStyle,
    dialogOverlay,
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

type DialogContentProps = ComponentPropsWithRef<typeof RadixDialog.Content> &
    RecipeVariants<typeof dialogContent> & {
        children: ReactNode;
    };

export function DialogContent({
    children,
    className,
    layer,
    ...props
}: DialogContentProps) {
    const combinedClassName = [dialogContent({ layer }), className]
        .filter(Boolean)
        .join(" ");

    return (
        <RadixDialog.Portal>
            <RadixDialog.Overlay asChild>
                <Overlay className={dialogOverlay({ layer })} />
            </RadixDialog.Overlay>
            <RadixDialog.Content className={combinedClassName} {...props}>
                {children}
            </RadixDialog.Content>
        </RadixDialog.Portal>
    );
}
