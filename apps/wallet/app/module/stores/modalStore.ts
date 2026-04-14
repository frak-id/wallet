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

import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import { create } from "zustand";
import type { ExplorerMerchantItem } from "@/module/explorer/component/ExplorerCard/types";

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
    | { id: "successOverlay" }
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
