import type { ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowDownIcon } from "../../icons/ArrowDownIcon";
import { Box } from "../Box";
import { Spinner } from "../Spinner";
import { content, iconWrapper, indicator, root } from "./pullToRefresh.css";

type PullToRefreshProps = {
    /** Called when the pull crosses the threshold and is released. May be async. */
    onRefresh: () => void | Promise<void>;
    /** Ref to the scroll container that owns the scrollbar. Required. */
    scrollContainerRef: RefObject<HTMLElement | null>;
    /** Pull distance (px) at which release triggers a refresh. Default 70. */
    threshold?: number;
    /** Maximum pull distance after damping. Default 120. */
    maxPull?: number;
    /** Damping factor — higher = stiffer feel. Default 2.5. */
    resistance?: number;
    /** Disable handlers (e.g., during a page-level modal). Default false. */
    disabled?: boolean;
    children: ReactNode;
};

/**
 * Pull-to-refresh wrapper for touch devices.
 * On non-touch environments, renders children unchanged with no listeners.
 *
 * Attaches listeners to `scrollContainerRef` so the scroll container
 * (typically <main> in AppShell) is the event target, not window/document.
 *
 * Hot deps (`onRefresh`, `refreshing`) are read through refs inside
 * handlers so the listener-attaching effect does NOT re-run on every
 * refresh cycle or whenever a consumer passes an inline callback.
 */
export function PullToRefresh({
    onRefresh,
    scrollContainerRef,
    threshold = 70,
    maxPull = 120,
    resistance = 2.5,
    disabled = false,
    children,
}: PullToRefreshProps) {
    // Touch capability is sniffed once at first render and never re-evaluated.
    // Hybrid devices (e.g. Surface, iPad with trackpad) that toggle between
    // touch and pointer mid-session will keep whichever mode they advertised
    // at mount. This is an accepted trade-off: the wallet is mobile-first, the
    // check is cheap, and re-running it per render would only add complexity
    // without a real-world signal to react to (no spec event for input-mode
    // changes). Consumers needing live re-evaluation can remount this component.
    //
    // Both checks are required: some Chromium desktop builds expose
    // `ontouchstart` even without a touchscreen. `maxTouchPoints > 0` confirms
    // real touch hardware and excludes those false positives.
    const isTouch =
        typeof window !== "undefined" &&
        "ontouchstart" in window &&
        navigator.maxTouchPoints > 0;

    const [refreshing, setRefreshing] = useState(false);

    // Mutable refs to avoid stale-closure rerenders on every touchmove frame
    const startYRef = useRef(0);
    const pullRef = useRef(0);
    const pullingRef = useRef(false);
    // Hot deps mirrored into refs so handlers always see the latest value
    // without forcing the listener-attaching effect to rerun.
    const refreshingRef = useRef(false);
    const onRefreshRef = useRef(onRefresh);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const iconWrapperRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Keep the latest onRefresh available to handlers without re-attaching
    // listeners every render.
    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    useEffect(() => {
        if (!isTouch || disabled) return;

        const ref = scrollContainerRef.current;
        if (!ref) return;
        // Explicit non-null typed const so closures retain the narrowed type
        const container: HTMLElement = ref;

        function setTransition(enabled: boolean) {
            const indicatorTransition = enabled
                ? "transform 200ms ease, opacity 200ms ease"
                : "none";
            const transformTransition = enabled
                ? "transform 200ms ease"
                : "none";
            if (indicatorRef.current) {
                indicatorRef.current.style.transition = indicatorTransition;
            }
            if (iconWrapperRef.current) {
                iconWrapperRef.current.style.transition = transformTransition;
            }
            if (contentRef.current) {
                contentRef.current.style.transition = transformTransition;
            }
        }

        function applyPull(pull: number) {
            const progress = Math.min(pull / threshold, 1);
            const indicatorY = pull - 40;

            if (indicatorRef.current) {
                indicatorRef.current.style.transform = `translate3d(-50%, ${indicatorY}px, 0)`;
                indicatorRef.current.style.opacity = String(progress);
            }
            // Rotate the arrow as the user pulls. At threshold (progress=1)
            // it points up — visual cue that release will trigger a refresh.
            // Skip while refreshing so the upright spinner isn't rotated.
            if (iconWrapperRef.current && !refreshingRef.current) {
                iconWrapperRef.current.style.transform = `rotate(${progress * 180}deg)`;
            }
            if (contentRef.current) {
                contentRef.current.style.transform = `translate3d(0, ${pull}px, 0)`;
            }
        }

        function resetPull() {
            setTransition(true);
            applyPull(0);
            pullRef.current = 0;
            pullingRef.current = false;
        }

        function handleTouchStart(e: TouchEvent) {
            if (refreshingRef.current) return;
            // Always seed startY — even when scrolled — so handleTouchMove
            // never falls back to a stale value from a prior touch session.
            startYRef.current = e.touches[0].clientY;
            pullingRef.current = false;
            pullRef.current = 0;
        }

        // Handles a touchmove that should NOT translate into a pull — either
        // the container is still scrolled, or the finger has moved up. While
        // scrolled, we keep startY in sync with the finger so that when
        // scrollTop reaches 0 mid-gesture, dy is measured from that moment
        // forward and prior scrolling doesn't get counted as a pull.
        function rejectMove(clientY: number, isScrolled: boolean) {
            if (pullingRef.current) {
                resetPull();
            }
            if (isScrolled) {
                startYRef.current = clientY;
            }
        }

        function handleTouchMove(e: TouchEvent) {
            if (refreshingRef.current) return;

            const clientY = e.touches[0].clientY;
            const isScrolled = container.scrollTop > 0;
            const dy = clientY - startYRef.current;

            if (isScrolled || dy <= 0) {
                rejectMove(clientY, isScrolled);
                return;
            }

            // Arm pulling on first positive dy
            if (!pullingRef.current) {
                pullingRef.current = true;
                setTransition(false);
            }

            e.preventDefault();

            const damped = Math.min(maxPull, dy / resistance);
            pullRef.current = damped;
            applyPull(damped);
        }

        async function handleTouchEnd() {
            if (!pullingRef.current || refreshingRef.current) return;

            const currentPull = pullRef.current;
            pullingRef.current = false;

            if (currentPull >= threshold) {
                setTransition(true);
                // Snap indicator + content to threshold height
                applyPull(threshold);
                // Reset icon rotation so the upcoming spinner appears upright.
                if (iconWrapperRef.current) {
                    iconWrapperRef.current.style.transform = "rotate(0deg)";
                }
                refreshingRef.current = true;
                setRefreshing(true);
                try {
                    await onRefreshRef.current();
                } finally {
                    resetPull();
                    refreshingRef.current = false;
                    setRefreshing(false);
                }
            } else {
                resetPull();
            }
        }

        container.addEventListener("touchstart", handleTouchStart, {
            passive: true,
        });
        container.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        container.addEventListener("touchend", handleTouchEnd, {
            passive: true,
        });
        container.addEventListener("touchcancel", handleTouchEnd, {
            passive: true,
        });

        return () => {
            container.removeEventListener("touchstart", handleTouchStart);
            container.removeEventListener("touchmove", handleTouchMove);
            container.removeEventListener("touchend", handleTouchEnd);
            container.removeEventListener("touchcancel", handleTouchEnd);
            // If the consumer toggles `disabled` (or unmounts) mid-pull,
            // snap the indicator and content back to 0 so the DOM doesn't
            // keep stale inline transforms.
            if (pullingRef.current) {
                resetPull();
            }
        };
    }, [isTouch, disabled, scrollContainerRef, threshold, maxPull, resistance]);

    // On non-touch devices, transparent passthrough
    if (!isTouch) {
        return <>{children}</>;
    }

    return (
        <Box className={root}>
            {/* Indicator pill */}
            <Box
                as="div"
                ref={indicatorRef}
                className={indicator}
                aria-hidden="true"
            >
                <Box as="div" ref={iconWrapperRef} className={iconWrapper}>
                    {refreshing ? (
                        <Spinner size="s" />
                    ) : (
                        <ArrowDownIcon width={16} height={16} />
                    )}
                </Box>
            </Box>

            {/* Content wrapper — translates down with the finger */}
            <Box as="div" ref={contentRef} className={content}>
                {children}
            </Box>
        </Box>
    );
}
