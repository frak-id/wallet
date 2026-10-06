import { useCallback, useRef, useState } from "react";

const SWIPE_MS = 250;
// transitionend can be dropped (e.g. backgrounded mid-slide); never strand the overlay.
const SWIPE_FALLBACK_MS = SWIPE_MS + 150;

const SWIPE_TRANSITION = `transform ${SWIPE_MS}ms ease-out`;

export const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Transitions `el` to `transform`, then calls `done`; instant under Reduce Motion. */
export function animateTransform(
    el: HTMLElement,
    transform: string,
    done: () => void
) {
    if (prefersReducedMotion()) return done();
    const finish = () => {
        clearTimeout(timer);
        el.removeEventListener("transitionend", onEnd);
        done();
    };
    const onEnd = (event: TransitionEvent) => {
        if (event.target === el && event.propertyName === "transform") finish();
    };
    const timer = setTimeout(finish, SWIPE_FALLBACK_MS);
    el.addEventListener("transitionend", onEnd);
    el.style.transition = SWIPE_TRANSITION;
    el.style.transform = transform;
}

/**
 * Manages the close animation for portal overlays.
 * Triggers a CSS closing animation, then calls `onClose` when it ends.
 * `slideOut` is the swipe variant: slides off to the right, then the same `onClose`.
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

    const slideOut = useCallback(() => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;
        const el = overlayRef.current;
        if (!el) return onClose();
        animateTransform(el, "translateX(100%)", onClose);
    }, [onClose]);

    return { isClosing, overlayRef, handleClose, slideOut } as const;
}
