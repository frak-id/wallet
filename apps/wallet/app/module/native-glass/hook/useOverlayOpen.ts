import { BANNER_STACK_ATTRIBUTE } from "@frak-labs/design-system/components/BannerStack";
import { useSyncExternalStore } from "react";
import { useDetailOverlayClosing } from "@/module/common/component/DetailOverlay";
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

/**
 * Whether any web overlay is open. A native view always paints above the
 * webview, so native chrome must step aside for them; `modalStore` covers the
 * `DetailSheet` modals, which lock nothing.
 */
export function useOverlayOpen(): boolean {
    const hasModal = modalStore((s) => s.modal !== null);
    const scrollLocked = useScrollLocked();
    return hasModal || scrollLocked;
}

/**
 * Whether native chrome owned by a detail sheet should show: hidden as soon as
 * the sheet starts its fade-out, and while a Radix or vaul overlay sits on top.
 */
export function useDetailSheetChromeVisible(): boolean {
    const closing = useDetailOverlayClosing();
    const scrollLocked = useScrollLocked();
    return !closing && !scrollLocked;
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

/** Whether a status banner shows in the top `BannerStack`, where it would sit under top native chrome. */
export function useTopBannerShown(): boolean {
    return useSyncExternalStore(subscribeBanners, hasBanner);
}
