import { BANNER_STACK_ATTRIBUTE } from "@frak-labs/design-system/components/BannerStack";
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { useDetailOverlayLeaving } from "@/module/common/component/DetailOverlay";
import { modalStore } from "@/module/stores/modalStore";

// Set on <body> by react-remove-scroll, which every Radix modal and vaul drawer mounts.
const SCROLL_LOCK_ATTRIBUTE = "data-scroll-locked";

function subscribeScrollLock(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: [SCROLL_LOCK_ATTRIBUTE],
    });
    return () => observer.disconnect();
}

function isScrollLocked() {
    return document.body.hasAttribute(SCROLL_LOCK_ATTRIBUTE);
}

/** Whether a Radix modal or vaul drawer is open. */
export function useScrollLocked(): boolean {
    return useSyncExternalStore(subscribeScrollLock, isScrollLocked);
}

/** Screen edge a piece of native chrome is pinned to. */
export type NativeEdge = "top" | "bottom";

const coverStore = create<{ full: number; bottom: number }>(() => ({
    full: 0,
    bottom: 0,
}));

/**
 * Marks a web surface native chrome must not draw over while mounted: a
 * full-screen gate (`full`), or a prompt pinned to the bottom edge.
 */
export function useCoverNativeChrome(extent: "full" | "bottom") {
    useEffect(() => {
        const bump = (by: number) =>
            coverStore.setState((s) =>
                extent === "full"
                    ? { full: s.full + by }
                    : { bottom: s.bottom + by }
            );
        bump(1);
        return () => bump(-1);
    }, [extent]);
}

function useEdgeCovered(edge: NativeEdge): boolean {
    const full = coverStore((s) => s.full > 0);
    const bottom = coverStore((s) => s.bottom > 0);
    const banner = useTopBannerShown();
    return full || (edge === "top" ? banner : bottom);
}

/**
 * Whether any web overlay covers `edge`. A native view always paints above
 * the webview, so native chrome must step aside for them; `modalStore` covers
 * the `DetailSheet` modals, which lock nothing.
 */
export function useOverlayOpen(edge: NativeEdge): boolean {
    const hasModal = modalStore((s) => s.modal !== null);
    const scrollLocked = useScrollLocked();
    const covered = useEdgeCovered(edge);
    return hasModal || scrollLocked || covered;
}

/**
 * Whether native chrome owned by a detail sheet should show: hidden as soon as
 * the sheet starts leaving, and while an overlay covers its edge. Native views
 * cannot follow a sheet's swipe, so they step aside for it.
 */
export function useDetailSheetChromeVisible(edge: NativeEdge): boolean {
    const leaving = useDetailOverlayLeaving();
    const scrollLocked = useScrollLocked();
    const covered = useEdgeCovered(edge);
    return !leaving && !scrollLocked && !covered;
}

const BANNER_STACK_SELECTOR = `[${BANNER_STACK_ATTRIBUTE}]`;

function subscribeBanners(onChange: () => void) {
    const stack = document.querySelector(BANNER_STACK_SELECTOR);
    if (!stack) return () => {};
    const observer = new MutationObserver(onChange);
    observer.observe(stack, { childList: true });
    return () => observer.disconnect();
}

function hasBanner() {
    const stack = document.querySelector(BANNER_STACK_SELECTOR);
    return (stack?.childElementCount ?? 0) > 0;
}

/** Whether a status banner shows in the top `BannerStack`. */
function useTopBannerShown(): boolean {
    return useSyncExternalStore(subscribeBanners, hasBanner);
}
