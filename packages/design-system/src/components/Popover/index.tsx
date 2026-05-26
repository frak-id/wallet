import * as RadixPopover from "@radix-ui/react-popover";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { popoverContentStyle } from "./popover.css";

export const Popover = RadixPopover.Root;

export const PopoverTrigger = RadixPopover.Trigger;

export const PopoverAnchor = RadixPopover.Anchor;

export const PopoverPortal = RadixPopover.Portal;

export function PopoverContent({
    className,
    align = "center",
    sideOffset = 4,
    ...props
}: ComponentPropsWithRef<typeof RadixPopover.Content>) {
    return (
        <RadixPopover.Portal>
            <RadixPopover.Content
                className={clsx(popoverContentStyle, className)}
                align={align}
                sideOffset={sideOffset}
                {...props}
            />
        </RadixPopover.Portal>
    );
}
