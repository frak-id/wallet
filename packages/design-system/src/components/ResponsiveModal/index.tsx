import type { ReactNode } from "react";
import { tablet } from "../../breakpoints";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { visuallyHidden } from "../../reset.css";
import { Dialog, DialogContent, DialogTitle } from "../Dialog";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "../Drawer";
import { responsiveModalHeaderStyle } from "./responsiveModal.css";

type ResponsiveModalProps = {
    /**
     * Controlled open state.
     */
    open: boolean;
    /**
     * Called when the open state should change.
     */
    onOpenChange: (open: boolean) => void;
    /**
     * Accessible title (visually hidden but read by screen readers).
     */
    title: string;
    /**
     * Accessible description (visually hidden but read by screen readers).
     */
    description: string;
    /**
     * Optional header content rendered above the body (typically a close button).
     * In the Drawer variant it is placed inside the DrawerHeader;
     * in the Dialog variant it is rendered before the children.
     */
    header?: ReactNode;
    /**
     * The modal body content.
     */
    children: ReactNode;
};

/**
 * Renders a Dialog (centred overlay) on tablet+ and a bottom Drawer on mobile.
 *
 * Both variants receive the same accessible title / description
 * (visually hidden) and the same body content.
 */
export function ResponsiveModal({
    open,
    onOpenChange,
    title,
    description,
    header,
    children,
}: ResponsiveModalProps) {
    const isDesktop = useMediaQuery(`(min-width: ${tablet}px)`);

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogTitle className={visuallyHidden}>{title}</DialogTitle>
                <DialogContent>
                    {header && (
                        <div className={responsiveModalHeaderStyle}>
                            {header}
                        </div>
                    )}
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
