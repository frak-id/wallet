import * as RadixDialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { X } from "lucide-react";
import type { ComponentProps, ComponentPropsWithRef, ReactNode } from "react";
import { Overlay } from "../Overlay";
import {
    sheetCloseStyle,
    sheetContent,
    sheetDescriptionStyle,
    sheetFooterStyle,
    sheetHeaderStyle,
    sheetTitleStyle,
} from "./sheet.css";

export { SheetToolbar } from "./SheetToolbar";

export type SheetSide = "top" | "right" | "bottom" | "left";
export type SheetSize = "default" | "wide";

export const Sheet = RadixDialog.Root;

export const SheetTrigger = RadixDialog.Trigger;

export const SheetClose = RadixDialog.Close;

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

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
    return <div className={clsx(sheetHeaderStyle, className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
    return <div className={clsx(sheetFooterStyle, className)} {...props} />;
}

type SheetContentProps = ComponentPropsWithRef<typeof RadixDialog.Content> & {
    side?: SheetSide;
    /** Tablet+ width preset for right / left sheets. Ignored for top / bottom. */
    size?: SheetSize;
    children: ReactNode;
    /** Hides the built-in close (X) button. */
    hideCloseButton?: boolean;
    /**
     * Apply the default 24px padding + 16px vertical gap to the content.
     * Set to `false` when using `SheetToolbar` (or any custom header) that
     * manages its own padding edge-to-edge.
     */
    padded?: boolean;
};

export function SheetContent({
    side = "right",
    size = "default",
    className,
    children,
    hideCloseButton = false,
    padded = true,
    ...props
}: SheetContentProps) {
    return (
        <RadixDialog.Portal>
            <RadixDialog.Overlay asChild>
                <Overlay />
            </RadixDialog.Overlay>
            <RadixDialog.Content
                aria-describedby={undefined}
                className={clsx(
                    sheetContent({ side, size, padded }),
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
