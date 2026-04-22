/**
 * Zustand store for modal management
 *
 * Centralises which modal is currently visible so parent components
 * don't need one `useState` per modal. Modals are stacked: opening
 * a new one pushes the previous onto the stack, and closing pops it.
 *
 * Each variant in `ModalState` can carry its own typed props,
 * so callers pass data at open-time and the `ModalOutlet`
 * forwards it to the correct component.
 *
 * TODO: Replace with route-based modals once TanStack Router parallel
 * routing lands: https://github.com/TanStack/router/pull/6302
 */

import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { trackEvent, type RewardHistoryItem } from "@frak-labs/wallet-shared";
import { create } from "zustand";

/**
 * Discriminated union of every modal in the wallet app.
 * Extend with new variants (and optional per-variant props) as needed.
 */
export type ModalState =
    | { id: "emptyTransfer" }
    | { id: "emptyPendingGains" }
    | { id: "pendingGains" }
    | { id: "emptyTransferredGains" }
    | { id: "transfer" }
    | { id: "explorerDetail"; merchant: ExplorerMerchantItem }
    | { id: "welcomeDetail" }
    | { id: "keypass"; onAuthSuccess: () => void }
    | {
          id: "recoveryCodeSuccess";
          merchant?: { name: string; domain: string };
      }
    | { id: "moneriumBankFlow" }
    | { id: "rewardDetail"; item: RewardHistoryItem };

const maxStackDepth = 5;

type ModalStore = {
    stack: ModalState[];
    modal: ModalState | null;
    openModal: (modal: ModalState) => void;
    closeModal: () => void;
};

export const modalStore = create<ModalStore>()((set) => ({
    stack: [],
    modal: null,
    openModal: (modal) =>
        set((state) => {
            // If reopening the same modal, just refresh its data
            if (state.modal?.id === modal.id) {
                return { modal };
            }
            // Remove duplicate from stack if present
            const filtered = state.stack.filter((m) => m.id !== modal.id);
            // Push current modal to stack
            const newStack = state.modal
                ? [...filtered, state.modal].slice(-maxStackDepth)
                : filtered;
            return { modal, stack: newStack };
        }),
    closeModal: () =>
        set((state) => {
            if (state.stack.length === 0) {
                return { modal: null, stack: [] };
            }
            const newStack = [...state.stack];
            const previous = newStack.pop() ?? null;
            return { modal: previous, stack: newStack };
        }),
}));

/**
 * Selector: the current modal state (or null).
 */
export const selectModal = (state: ModalStore) => state.modal;

/**
 * Auto-tracking subscription — mirrors OpenPanel's page auto-tracking
 * philosophy. Every modal transition through `ModalOutlet` produces a
 * `wallet_modal_opened` + `wallet_modal_closed` pair without requiring
 * any per-modal instrumentation.
 *
 * `from_stack = true` means the modal re-appeared because the user closed
 * a modal stacked on top of it (e.g. close `keypass` to reveal `transfer`
 * again). Lets dashboards exclude those transitions if they want clean
 * "new intent" counts.
 */
let currentOpenedAt: number | null = null;
modalStore.subscribe((state, prev) => {
    const current = state.modal?.id;
    const previous = prev.modal?.id;
    if (current === previous) return;

    if (previous && currentOpenedAt !== null) {
        trackEvent("wallet_modal_closed", {
            modal: previous,
            duration_ms: Date.now() - currentOpenedAt,
        });
    }

    if (current) {
        currentOpenedAt = Date.now();
        // If the new current modal was already in the previous stack,
        // the user popped back to it rather than opening a fresh one.
        const fromStack = prev.stack.some((m) => m.id === current);
        trackEvent("wallet_modal_opened", {
            modal: current,
            from_stack: fromStack,
        });
    } else {
        currentOpenedAt = null;
    }
});
