import { type RefObject, useEffect, useRef, useState } from "react";

type ToolbarTitleReveal = {
    /** Attach to the hero image; drives the scroll-edge blur. */
    heroRef: RefObject<HTMLDivElement | null>;
    /** Attach to the large in-body title that scrolls under the toolbar. */
    titleRef: RefObject<HTMLHeadingElement | null>;
    /** Attach to the fixed toolbar band; its padding insets the observer root. */
    toolbarRef: RefObject<HTMLDivElement | null>;
    /** `true` once the hero picture has scrolled above the safe area. */
    blurred: boolean;
    /** `true` once the large title has scrolled up behind the toolbar. */
    revealed: boolean;
};

/**
 * Drive the DetailSheet's two toolbar affordances from scroll position — the
 * sheet counterpart to the Explorer page's in-place title collapse. Both are
 * viewport-based `IntersectionObserver`s whose root top edge is inset by the
 * toolbar band's top offset (the toolbar's own `padding-top`, which resolves to
 * `max(spacing, safe-area inset)` per device), so each flips exactly at the
 * safe-area line — behind the status bar / notch on real devices.
 *
 * - `blurred`: the scroll-edge blur fades in once the hero *picture* passes the
 *   safe-area line, so the large name is softened the moment it scrolls up
 *   behind the status bar rather than showing through sharply. The hero sits
 *   full-bleed behind the notch with the name right beneath it, so this also
 *   frosts the last thin edge of the photo as it leaves — the accepted
 *   trade-off (the spec keeps the blur on in both resting and scrolled states).
 * - `revealed`: the centered toolbar title reveals a beat later, once the large
 *   name itself clears the safe-area line, so the two never overlap.
 *
 * Each is a single boolean toggle at its threshold, not a per-frame re-render.
 */
export function useToolbarTitleReveal(): ToolbarTitleReveal {
    const heroRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [blurred, setBlurred] = useState(false);
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        let observers: IntersectionObserver[] = [];

        const connect = () => {
            for (const observer of observers) observer.disconnect();
            observers = [];

            const toolbar = toolbarRef.current;
            const bandTop = toolbar
                ? Number.parseFloat(
                      window.getComputedStyle(toolbar).paddingTop
                  ) || 0
                : 0;
            // Both flip at the safe-area line (root inset by the band's
            // padding): the blur when the hero clears it, the title a beat
            // later when the name clears it. Each element is guarded on its
            // own so one detaching can't silence the other affordance.
            const rootMargin = `-${Math.round(bandTop)}px 0px 0px 0px`;
            const observe = (
                element: Element | null,
                set: (value: boolean) => void
            ) => {
                if (!element) return;
                const observer = new IntersectionObserver(
                    ([entry]) => set(!entry.isIntersecting),
                    { root: null, rootMargin, threshold: 0 }
                );
                observer.observe(element);
                observers.push(observer);
            };

            observe(heroRef.current, setBlurred);
            observe(titleRef.current, setRevealed);
        };

        connect();

        // The safe-area inset (and thus the band-top threshold baked into
        // rootMargin) can change after mount — Tauri injects the CSS var async
        // at bootstrap, and orientation changes alter it. Re-measure and rewire
        // on viewport changes so the thresholds keep tracking the safe area.
        // Coalesce to one reconnect per frame so a desktop drag-resize doesn't
        // churn observer teardown/recreation on every event.
        let frame = 0;
        const scheduleConnect = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                connect();
            });
        };
        window.addEventListener("resize", scheduleConnect);
        window.addEventListener("orientationchange", scheduleConnect);
        return () => {
            if (frame) cancelAnimationFrame(frame);
            window.removeEventListener("resize", scheduleConnect);
            window.removeEventListener("orientationchange", scheduleConnect);
            for (const observer of observers) observer.disconnect();
        };
    }, []);

    return { heroRef, titleRef, toolbarRef, blurred, revealed };
}
