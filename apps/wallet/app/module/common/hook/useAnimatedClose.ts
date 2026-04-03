import { useCallback, useRef, useState } from "react";

/**
 * Manages the close animation for portal overlays.
 * Triggers a CSS closing animation, then calls `onClose` when it ends.
 */
export function useAnimatedClose(onClose: () => void) {
    const [isClosing, setIsClosing] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        const el = overlayRef.current;
        if (!el) {
            onClose();
            return;
        }
        el.addEventListener("animationend", onClose, { once: true });
    }, [onClose]);

    return { isClosing, overlayRef, handleClose } as const;
}
