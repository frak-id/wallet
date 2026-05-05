import clsx from "clsx";
import type { ReactNode } from "react";

import { placement, surface } from "./toastSurface.css";

type ToastPlacement = keyof typeof placement;

type ToastSurfaceProps = {
    children: ReactNode;
    placement?: ToastPlacement;
    className?: string;
};

/**
 * Positioning slot for transient overlays such as `ConfirmationTooltip`.
 *
 * Renders an absolutely-positioned, click-through layer anchored inside
 * the nearest positioned ancestor. The page hosting the toast must
 * therefore set `position: relative` on its scroll/layout root.
 */
export function ToastSurface({
    children,
    placement: placementProp = "top-center",
    className,
}: ToastSurfaceProps) {
    return (
        <div className={clsx(surface, placement[placementProp], className)}>
            {children}
        </div>
    );
}
