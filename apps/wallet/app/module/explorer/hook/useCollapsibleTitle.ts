import { type RefObject, useEffect, useRef, useState } from "react";
import { useAppShellScroll } from "@/module/common/component/AppShell";

// Tracks the GlassButton's height (its own size is a private design-system
// constant, not an exported token — mirrored here rather than bridged across
// the JS/CSS boundary for one call site).
const BUTTON_ROW_HEIGHT = 44;

type CollapsibleTitle = {
    /** Attach to the sticky action row — its resting offset sets the trigger. */
    headerRef: RefObject<HTMLDivElement | null>;
    /** Attach to the zero-height sentinel at the top of the scrolling content
     *  (it crossing the toolbar is the collapse trigger). */
    sentinelRef: RefObject<HTMLSpanElement | null>;
    /** True once the large title has scrolled up under the button row. */
    collapsed: boolean;
};

/**
 * Drives the iOS large-title collapse: the title is sticky and pins itself, so
 * we watch the scrolling content below it against a trigger line measured from
 * the pinned header (safe-area aware). It fires exactly when that content
 * reaches the bottom of the buttons — i.e. when the title has finished pinning.
 */
export function useCollapsibleTitle(): CollapsibleTitle {
    const scrollRef = useAppShellScroll();
    const headerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLSpanElement>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const sentinelEl = sentinelRef.current;
        const scroller = scrollRef.current;
        if (!sentinelEl || !scroller) return;

        // Fallback tracks the scroller's content padding (spacing.m); a literal
        // because getBoundingClientRect math needs a number and the token is a
        // CSS string.
        const headerTop = headerRef.current
            ? headerRef.current.getBoundingClientRect().top -
              scroller.getBoundingClientRect().top
            : 16;
        const triggerLine =
            Math.max(0, Math.round(headerTop)) + BUTTON_ROW_HEIGHT;

        // Measured once on mount: the app is portrait-locked (iOS + Android)
        // and the web safe-area inset is 0, so the header's resting offset
        // can't shift under us — no resize/orientation recompute needed.
        const observer = new IntersectionObserver(
            ([entry]) => setCollapsed(!entry.isIntersecting),
            { root: scroller, rootMargin: `-${triggerLine}px 0px 0px 0px` }
        );
        observer.observe(sentinelEl);
        return () => observer.disconnect();
    }, [scrollRef]);

    return { headerRef, sentinelRef, collapsed };
}
