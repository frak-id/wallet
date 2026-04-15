import clsx from "clsx";
import type { ComponentProps, CSSProperties } from "react";
import {
    actionsStyle,
    bodyStyle,
    containerStyle,
    footerStyle,
    heroStyle,
} from "./detailSheet.css";

/**
 * Root container — flex column, full-screen height, safe-area top.
 * Wraps all DetailSheet compound parts.
 */
export function DetailSheet({
    className,
    children,
    ...props
}: ComponentProps<"div">) {
    return (
        <div className={clsx(containerStyle, className)} {...props}>
            {children}
        </div>
    );
}

/**
 * Hero image area — relative positioned, overflow hidden.
 * Accepts a `height` prop (default 350) that sets --detail-sheet-hero-height CSS var.
 * Place `DetailSheetActions` inside here for correct absolute positioning.
 */
export function DetailSheetHero({
    className,
    children,
    height = 350,
    style,
    ...props
}: ComponentProps<"div"> & { height?: number | string }) {
    return (
        <div
            className={clsx(heroStyle, className)}
            style={
                {
                    "--detail-sheet-hero-height":
                        typeof height === "number" ? `${height}px` : height,
                    ...style,
                } as CSSProperties
            }
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * Floating actions bar — absolutely positioned at top of hero.
 * Must be rendered INSIDE `DetailSheetHero` for correct positioning.
 */
export function DetailSheetActions({
    className,
    children,
    ...props
}: ComponentProps<"div">) {
    return (
        <div className={clsx(actionsStyle, className)} {...props}>
            {children}
        </div>
    );
}

/**
 * White card body — overlaps hero with negative margin, rounded top corners.
 * Main scrollable content area.
 */
export function DetailSheetBody({
    className,
    children,
    ...props
}: ComponentProps<"div">) {
    return (
        <div className={clsx(bodyStyle, className)} {...props}>
            {children}
        </div>
    );
}

/**
 * Sticky footer — flex-pinned at bottom, safe-area bottom padding.
 * Use for CTA buttons and bottom actions.
 */
export function DetailSheetFooter({
    className,
    children,
    ...props
}: ComponentProps<"div">) {
    return (
        <div className={clsx(footerStyle, className)} {...props}>
            {children}
        </div>
    );
}
