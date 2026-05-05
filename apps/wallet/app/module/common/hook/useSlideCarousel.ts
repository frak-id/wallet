import type { RefObject } from "react";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

/**
 * Returns the data-index of the entry with the highest intersection ratio,
 * or -1 if no intersecting entry is found.
 *
 * Picking by ratio (rather than last-write-wins) prevents desktop browsers
 * from landing on a wrong slide when multiple entries are batched together
 * during a smooth-scroll animation.
 */
function mostVisibleIndex(entries: IntersectionObserverEntry[]): number {
    let bestIndex = -1;
    let bestRatio = 0;

    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.intersectionRatio <= bestRatio) continue;

        const index = Number((entry.target as HTMLElement).dataset.index);
        if (!Number.isNaN(index)) {
            bestIndex = index;
            bestRatio = entry.intersectionRatio;
        }
    }

    return bestIndex;
}

type UseSlideCarouselOptions = {
    slideCount: number;
    /** Starting slide index, e.g. restored from persisted storage. Defaults to 0. */
    initialIndex?: number;
    /** Called whenever the active slide changes (programmatic or manual swipe). */
    onIndexChange?: (index: number) => void;
};

type UseSlideCarouselReturn = {
    currentIndex: number;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    goToIndex: (index: number) => void;
    goToNext: () => void;
};

export function useSlideCarousel({
    slideCount,
    initialIndex = 0,
    onIndexChange,
}: UseSlideCarouselOptions): UseSlideCarouselReturn {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    /**
     * Suppresses IntersectionObserver updates during programmatic scrolls.
     * Without this, smooth-scroll on desktop can report intermediate slides
     * as intersecting before settling, causing index to skip ahead.
     */
    const isProgrammaticScrollRef = useRef(false);

    useEffect(() => {
        onIndexChange?.(currentIndex);
    }, [currentIndex, onIndexChange]);

    // Pin the scroll position to `initialIndex` on mount — runs even when
    // `initialIndex` is 0 to defeat browser scroll restoration (WebKit /
    // iOS WebView preserve the inner scroll container's `scrollLeft`
    // across reloads, which would otherwise land the user on whatever
    // slide they were looking at last).
    // Captured in a ref so the effect dep array stays empty (mount-only).
    const initialIndexRef = useRef(initialIndex);
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        isProgrammaticScrollRef.current = true;
        container.scrollTo({
            left: container.clientWidth * initialIndexRef.current,
            behavior: "instant",
        });
        requestAnimationFrame(() => {
            isProgrammaticScrollRef.current = false;
        });
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Ignore observer callbacks triggered by goToIndex scroll
                if (isProgrammaticScrollRef.current) return;

                const index = mostVisibleIndex(entries);
                if (index !== -1) {
                    setCurrentIndex(index);
                }
            },
            {
                root: container,
                threshold: 0.5,
            }
        );

        const slideElements = container.querySelectorAll("[data-index]");
        for (const slideElement of slideElements) {
            observer.observe(slideElement);
        }

        return () => {
            observer.disconnect();
        };
    }, [slideCount]);

    useLayoutEffect(() => {
        if (slideCount === 0 || currentIndex < slideCount) return;

        const nextIndex = slideCount - 1;
        const container = scrollContainerRef.current;

        setCurrentIndex(nextIndex);

        if (!container) return;

        const frameId = requestAnimationFrame(() => {
            container.scrollTo({
                left: container.clientWidth * nextIndex,
                behavior: "auto",
            });
        });

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [currentIndex, slideCount]);

    const goToIndex = useCallback(
        (index: number) => {
            if (index < 0 || index >= slideCount) return;

            const container = scrollContainerRef.current;
            if (!container) return;

            // Each slide is flex: 0 0 100% of the scroll container's clientWidth.
            // Using clientWidth * index is reliable on all viewports, unlike
            // offsetLeft which is relative to offsetParent (not the scroll container)
            // and can return incorrect values on desktop when ancestor elements
            // have different positioning contexts.
            const targetLeft = container.clientWidth * index;

            isProgrammaticScrollRef.current = true;
            setCurrentIndex(index);
            container.scrollTo({
                left: targetLeft,
                behavior: "instant",
            });
            // Re-enable observer on the next frame, after the scroll settles
            requestAnimationFrame(() => {
                isProgrammaticScrollRef.current = false;
            });
        },
        [slideCount]
    );

    const goToNext = useCallback(() => {
        goToIndex(currentIndex + 1);
    }, [currentIndex, goToIndex]);

    return {
        currentIndex,
        scrollContainerRef,
        goToIndex,
        goToNext,
    };
}
