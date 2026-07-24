import { type RefObject, useEffect, useState } from "react";

type UseOneShotInViewOptions = {
    /**
     * Grow (or shrink) the viewport box the intersection is tested against,
     * e.g. `"300px"` to trigger one card-height before the element scrolls in.
     */
    rootMargin?: string;
    /** Visible fraction required to trigger (defaults to any pixel). */
    threshold?: number;
    /**
     * Start latched (skips observing entirely). For elements known to be
     * above the fold at mount.
     */
    initial?: boolean;
};

/**
 * Latches to `true` the first time the element intersects the viewport, then
 * disconnects — the value never goes back to `false`. For one-time triggers
 * like impression tracking or deferring a fetch until an element is near view.
 */
export function useOneShotInView(
    ref: RefObject<Element | null>,
    { rootMargin, threshold, initial = false }: UseOneShotInViewOptions = {}
): boolean {
    const [inView, setInView] = useState(initial);

    useEffect(() => {
        if (inView) return;
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin, threshold }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [inView, ref, rootMargin, threshold]);

    return inView;
}
