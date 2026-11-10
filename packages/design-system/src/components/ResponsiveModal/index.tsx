import { type ReactNode, useRef } from "react";
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
    // Opened from state, so Radix has no trigger to refocus on close.
    const returnFocusTo = useRef<HTMLElement | null>(null);
    const focusHandlers = {
        onOpenAutoFocus: () => {
            const active = document.activeElement;
            returnFocusTo.current =
                active instanceof HTMLElement ? active : null;
        },
        onCloseAutoFocus: (event: Event) => {
            const target = returnFocusTo.current;
            if (!target?.isConnected) return;
            event.preventDefault();
            target.focus();
        },
    };

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent {...focusHandlers}>
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
            <DrawerContent hideHandle={true} {...focusHandlers}>
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
