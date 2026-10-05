import { type RefObject, useEffect, useRef } from "react";
import { animateTransform } from "./useAnimatedClose";

const EDGE_STRIP_PX = 24;
const COMMIT_WIDTH_RATIO = 1 / 3;
const FLICK_MIN_DISTANCE_PX = 40;
const FLICK_MIN_VELOCITY_PX_PER_MS = 0.5;

const NOT_A_SWIPE_TARGET =
    'button, a, input, textarea, select, [role="button"], [data-owns-horizontal-drag]';

/** A drag may start only in the left-edge strip, outside controls and horizontal-drag owners. */
export function isSwipeStart(x: number, target: EventTarget | null) {
    return (
        x <= EDGE_STRIP_PX &&
        target instanceof Element &&
        !target.closest(NOT_A_SWIPE_TARGET)
    );
}

/** Commit past a third of the width, or on a fast rightward flick. */
export function shouldCommitSwipe(
    dx: number,
    width: number,
    elapsedMs: number
) {
    if (dx > width * COMMIT_WIDTH_RATIO) return true;
    return (
        dx >= FLICK_MIN_DISTANCE_PX &&
        dx / Math.max(elapsedMs, 1) >= FLICK_MIN_VELOCITY_PX_PER_MS
    );
}

type Phase = "idle" | "dragging" | "settling" | "committed";

/**
 * Drags the element right from the left edge; `onCommit` runs when the
 * release should close it, otherwise the element settles back to 0.
 */
export function useEdgeSwipeToClose({
    ref,
    enabled,
    onCommit,
}: {
    ref: RefObject<HTMLElement | null>;
    enabled: boolean;
    onCommit: () => void;
}) {
    const commitRef = useRef(onCommit);
    commitRef.current = onCommit;

    useEffect(() => {
        const el = ref.current;
        if (!enabled || !el) return;

        let phase: Phase = "idle";
        let pointerId = -1;
        let startX = 0;
        let startTime = 0;
        let width = 0;
        let offset = 0;

        const reset = () => {
            el.style.transition = "";
            el.style.transform = "";
            offset = 0;
            phase = "idle";
        };

        const settle = () => {
            if (offset === 0) return reset();
            phase = "settling";
            // A newer drag may have taken over before this settle finished.
            animateTransform(el, "translateX(0)", () => {
                if (phase === "settling") reset();
            });
        };

        const isActive = (e: PointerEvent) =>
            phase === "dragging" && e.pointerId === pointerId;

        const onDown = (e: PointerEvent) => {
            if (phase === "dragging" || phase === "committed") return;
            if (!isSwipeStart(e.clientX, e.target)) return;
            width = el.offsetWidth;
            reset();
            phase = "dragging";
            pointerId = e.pointerId;
            startX = e.clientX;
            startTime = e.timeStamp;
        };

        const onMove = (e: PointerEvent) => {
            if (!isActive(e)) return;
            offset = Math.max(0, e.clientX - startX);
            el.style.transform = `translateX(${offset}px)`;
        };

        const onUp = (e: PointerEvent) => {
            if (!isActive(e)) return;
            if (shouldCommitSwipe(offset, width, e.timeStamp - startTime)) {
                phase = "committed";
                commitRef.current();
            } else {
                settle();
            }
        };

        const onCancel = (e: PointerEvent) => {
            if (isActive(e)) settle();
        };

        const onVisibility = () => {
            if (document.hidden && phase === "dragging") settle();
        };

        el.addEventListener("pointerdown", onDown);
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
        el.addEventListener("pointercancel", onCancel);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            el.removeEventListener("pointerdown", onDown);
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerup", onUp);
            el.removeEventListener("pointercancel", onCancel);
            document.removeEventListener("visibilitychange", onVisibility);
            reset();
        };
    }, [ref, enabled]);
}
