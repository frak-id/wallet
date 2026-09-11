import { type ReactNode, useLayoutEffect } from "react";
import { tablet } from "../../breakpoints";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { visuallyHidden } from "../../reset.css";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "../Dialog";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "../Drawer";
import { responsiveModalHeaderStyle } from "./responsiveModal.css";

type ResponsiveModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Visually hidden, read by screen readers. */
    title: string;
    /** Visually hidden, read by screen readers. */
    description: string;
    /** Rendered inside the DrawerHeader on mobile, before the children on tablet+. */
    header?: ReactNode;
    children: ReactNode;
};

/** Dialog (centred overlay) on tablet+, bottom Drawer on mobile. */
export function ResponsiveModal({
    open,
    onOpenChange,
    title,
    description,
    header,
    children,
}: ResponsiveModalProps) {
    const isDesktop = useMediaQuery(`(min-width: ${tablet}px)`);

    // Radix applies `aria-hidden` to dialog siblings before its FocusScope
    // moves focus into the modal. If the trigger that opened the modal
    // still holds focus during that window, browsers emit:
    //   "Blocked aria-hidden on an element because its descendant retained focus".
    // Blurring the active element on the open transition closes the gap
    // for every consumer (controlled or uncontrolled).
    useLayoutEffect(() => {
        if (!open) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
    }, [open]);

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    {header && (
                        <div className={responsiveModalHeaderStyle}>
                            {header}
                        </div>
                    )}
                    <DialogTitle className={visuallyHidden}>
                        {title}
                    </DialogTitle>
                    <DialogDescription className={visuallyHidden}>
                        {description}
                    </DialogDescription>
                    {children}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            shouldScaleBackground={false}
            modal={true}
        >
            <DrawerContent hideHandle={true}>
                {header && (
                    <DrawerHeader className={responsiveModalHeaderStyle}>
                        {header}
                    </DrawerHeader>
                )}
                <DrawerTitle className={visuallyHidden}>{title}</DrawerTitle>
                <DrawerDescription className={visuallyHidden}>
                    {description}
                </DrawerDescription>
                {children}
            </DrawerContent>
        </Drawer>
    );
}
