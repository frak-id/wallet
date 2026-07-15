import { brand, fontSize } from "@frak-labs/design-system/tokens";
import { type RefObject, useEffect, useRef } from "react";
import { useAppShellScroll } from "@/module/common/component/AppShell";

// Typography end-points the scroll progress interpolates between: page title
// (fontSize 3xl / bold) at rest, toolbar title (fontSize m / semiBold) once
// collapsed. Derived from the same DS tokens the resting CSS uses so a token
// change can't desync the two. Weight interpolates because Inter is variable.
const BIG_FONT_PX = Number.parseInt(fontSize["3xl"], 10);
const SMALL_FONT_PX = Number.parseInt(fontSize.m, 10);
const BIG_WEIGHT = brand.typography.fontWeight.bold;
const SMALL_WEIGHT = brand.typography.fontWeight.semiBold;
// Scroll distance over which the title fully shrinks. A fixed value (not a
// measured travel) because the title collapses in place — the number is purely
// how "fast" the shrink tracks the scroll.
const COLLAPSE_SCROLL_DISTANCE = 96;

type ScrollMorphTitle = {
    /** Attach to the pinned page title being shrunk in place. */
    titleRef: RefObject<HTMLHeadingElement | null>;
};

/**
 * In-place variant of the iOS large-title collapse: the title is pinned in the
 * toolbar band and only its size changes, driven from scroll progress by a
 * rAF-throttled listener. Because the title never moves, the per-frame size
 * change has no position to desync from, so there is no scroll wobble. Styles
 * are written imperatively to avoid a re-render every frame.
 */
export function useScrollMorphTitle(): ScrollMorphTitle {
    const scrollRef = useAppShellScroll();
    const titleRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const scroller = scrollRef.current;
        const title = titleRef.current;
        // AppShell sets the scroll ref before child effects run, so both are
        // present on mount; bail without retry if that ever changes.
        if (!scroller || !title) return;

        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        const lerp = (from: number, to: number, p: number) =>
            from + (to - from) * p;

        let frame = 0;
        const apply = () => {
            frame = 0;
            let p = Math.min(
                1,
                Math.max(0, scroller.scrollTop / COLLAPSE_SCROLL_DISTANCE)
            );
            // Reduced motion: skip the continuous shrink, snap at the midpoint.
            if (reduceMotion) p = p < 0.5 ? 0 : 1;
            // Round to a half pixel so the glyphs don't re-snap every frame.
            const fontPx =
                Math.round(lerp(BIG_FONT_PX, SMALL_FONT_PX, p) * 2) / 2;
            title.style.fontSize = `${fontPx}px`;
            title.style.fontWeight = String(
                Math.round(lerp(BIG_WEIGHT, SMALL_WEIGHT, p))
            );
        };
        const onScroll = () => {
            if (frame) return;
            frame = requestAnimationFrame(apply);
        };

        apply();
        scroller.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            scroller.removeEventListener("scroll", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [scrollRef]);

    return { titleRef };
}
