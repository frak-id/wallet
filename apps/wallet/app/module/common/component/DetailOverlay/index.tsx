import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnimatedClose } from "@/module/common/hook/useAnimatedClose";
import * as styles from "@/module/common/styles/detailOverlay.css";

type DetailOverlayVariant = "fullScreen" | "bottomSheet";

type DetailOverlayProps = {
    onClose: () => void;
    children: (props: { handleClose: () => void }) => ReactNode;
    /**
     * `"fullScreen"` (default): mobile fills the viewport edge-to-edge,
     * desktop centres the content as a card over a dark backdrop.
     *
     * `"bottomSheet"`: mobile shows a dark backdrop with the sheet
     * bottom-anchored and top-rounded so the backdrop is visible above it.
     * Desktop falls back to the same centred-card layout.
     *
     * IMPORTANT — both variants style the **direct child** of the overlay
     * (rounded corners, max-height, etc.). Render exactly one element from
     * the `children` render-prop; fragments or multiple siblings break the
     * `> *` rules in `detailOverlay.css.ts`. Layered modals should portal
     * elsewhere (e.g. `ResponsiveModal` portals to `document.body`).
     */
    variant?: DetailOverlayVariant;
};

/**
 * Generic full-screen overlay wrapper for detail sheets.
 *
 * Portals its content to `document.body` with a fade-in/out animation.
 * Exposes `handleClose` via render-prop so children can trigger the
 * closing animation (which calls `onClose` once the animation ends).
 *
 * Render the overlay's body as a single element (see `variant`'s note on
 * the direct-child constraint).
 */
export function DetailOverlay({
    onClose,
    children,
    variant = "fullScreen",
}: DetailOverlayProps) {
    const { isClosing, overlayRef, handleClose } = useAnimatedClose(onClose);

    const className =
        variant === "bottomSheet"
            ? isClosing
                ? styles.bottomSheetClosing
                : styles.bottomSheetOverlay
            : isClosing
              ? styles.overlayClosing
              : styles.overlay;

    return createPortal(
        <div ref={overlayRef} className={className}>
            {children({ handleClose })}
        </div>,
        document.body
    );
}
