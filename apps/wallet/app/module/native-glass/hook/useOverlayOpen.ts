import { useSyncExternalStore } from "react";
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

/**
 * Whether any web overlay is open. A native view always paints above the
 * webview, so native chrome must step aside for them; `modalStore` covers the
 * `DetailSheet` modals, which lock nothing.
 */
export function useOverlayOpen(): boolean {
    const hasModal = modalStore((s) => s.modal !== null);
    const scrollLocked = useSyncExternalStore(
        subscribeScrollLock,
        isScrollLocked
    );
    return hasModal || scrollLocked;
}
