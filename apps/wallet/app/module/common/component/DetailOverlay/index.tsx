import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnimatedClose } from "@/module/common/hook/useAnimatedClose";
import * as styles from "@/module/common/styles/detailOverlay.css";

type DetailOverlayProps = {
    onClose: () => void;
    children: (props: { handleClose: () => void }) => ReactNode;
};

/**
 * Generic full-screen overlay wrapper for detail sheets.
 *
 * Portals its content to `document.body` with a fade-in/out animation.
 * Exposes `handleClose` via render-prop so children can trigger the
 * closing animation (which calls `onClose` once the animation ends).
 */
export function DetailOverlay({ onClose, children }: DetailOverlayProps) {
    const { isClosing, overlayRef, handleClose } = useAnimatedClose(onClose);

    return createPortal(
        <div
            ref={overlayRef}
            className={isClosing ? styles.overlayClosing : styles.overlay}
        >
            {children({ handleClose })}
        </div>,
        document.body
    );
}
