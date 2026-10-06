import type { selectModal } from "@/module/stores/modalStore";

type ModalId = NonNullable<ReturnType<typeof selectModal>>["id"];

/** Overlays that close on their own swipe, so WKWebView's back gesture must be off over them. */
const SWIPE_TO_CLOSE_MODAL_IDS: ReadonlySet<ModalId> = new Set<ModalId>([
    "explorerDetail",
    "rewardDetail",
    "moneriumOrderDetail",
    "welcomeDetail",
]);

export function isSwipeToCloseModal(id: ModalId | undefined): boolean {
    return id !== undefined && SWIPE_TO_CLOSE_MODAL_IDS.has(id);
}
