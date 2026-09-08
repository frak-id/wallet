import { useCallback, useRef, useState } from "react";

/**
 * Manages the close animation for portal overlays.
 * Triggers a CSS closing animation, then calls `onClose` when it ends.
 */
export function useAnimatedClose(onClose: () => void) {
    const [isClosing, setIsClosing] = useState(false);
    const isClosingRef = useRef(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const handleClose = useCallback(() => {
        // Re-entrant calls (Escape twice, or Escape then the close button)
        // would each register another `animationend` listener and fire
        // `onClose` once per call.
        if (isClosingRef.current) return;
        isClosingRef.current = true;
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
