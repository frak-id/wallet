import * as RadixDialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { X } from "lucide-react";
import type { ComponentProps, ComponentPropsWithRef, ReactNode } from "react";
import { Overlay } from "../Overlay";
import {
    sheetCloseStyle,
    sheetContentBaseStyle,
    sheetContentVariants,
    sheetDescriptionStyle,
    sheetFooterStyle,
    sheetHeaderStyle,
    sheetTitleStyle,
} from "./sheet.css";

export type SheetSide = "top" | "right" | "bottom" | "left";

/**
 * Stateless root — pairs trigger + content.
 */
export const Sheet = RadixDialog.Root;

/**
 * Element that opens the sheet on click.
 */
export const SheetTrigger = RadixDialog.Trigger;

/**
 * Close trigger for the sheet.
 */
export const SheetClose = RadixDialog.Close;

/**
 * Portal target for the sheet content (rarely needed directly).
 */
export const SheetPortal = RadixDialog.Portal;

/**
 * Accessible title for the sheet.
 */
export function SheetTitle({
    className,
    ...props
}: ComponentPropsWithRef<typeof RadixDialog.Title>) {
    return (
        <RadixDialog.Title
            className={clsx(sheetTitleStyle, className)}
            {...props}
        />
    );
}

/**
 * Accessible description for the sheet.
 */
export function SheetDescription({
    className,
    ...props
}: ComponentPropsWithRef<typeof RadixDialog.Description>) {
    return (
        <RadixDialog.Description
            className={clsx(sheetDescriptionStyle, className)}
            {...props}
        />
    );
}

/**
 * Header layout for sheet content.
 */
export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
    return <div className={clsx(sheetHeaderStyle, className)} {...props} />;
}

/**
 * Footer layout for sheet content.
 */
export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
    return <div className={clsx(sheetFooterStyle, className)} {...props} />;
}

type SheetContentProps = ComponentPropsWithRef<typeof RadixDialog.Content> & {
    side?: SheetSide;
    children: ReactNode;
    /** Hides the built-in close (X) button. */
    hideCloseButton?: boolean;
};

/**
 * Styled sheet content — portaled, animated, with overlay.
 */
export function SheetContent({
    side = "right",
    className,
    children,
    hideCloseButton = false,
    ...props
}: SheetContentProps) {
    return (
        <RadixDialog.Portal>
            <RadixDialog.Overlay asChild>
                <Overlay />
            </RadixDialog.Overlay>
            <RadixDialog.Content
                className={clsx(
                    sheetContentBaseStyle,
                    sheetContentVariants[side],
                    className
                )}
                {...props}
            >
                {children}
                {!hideCloseButton && (
                    <RadixDialog.Close asChild>
                        <button
                            type="button"
                            className={sheetCloseStyle}
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </RadixDialog.Close>
                )}
            </RadixDialog.Content>
        </RadixDialog.Portal>
    );
}
