/**
 * Zustand store for modal management
 *
 * Centralises which modal is currently visible so parent components
 * don't need one `useState` per modal.  Only **one** modal can be
 * open at a time (opening a new one closes the previous).
 *
 * Each variant in `ModalState` can carry its own typed props,
 * so callers pass data at open-time and the `ModalOutlet`
 * forwards it to the correct component.
 */

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
    | { id: "successOverlay" }
    | { id: "keypass"; onAuthSuccess: () => void }
    | { id: "recoveryCodeSuccess" };

type ModalStore = {
    modal: ModalState | null;
    openModal: (modal: ModalState) => void;
    closeModal: () => void;
};

export const modalStore = create<ModalStore>()((set) => ({
    modal: null,
    openModal: (modal) => set({ modal }),
    closeModal: () => set({ modal: null }),
}));

/**
 * Selector: the current modal state (or null).
 */
export const selectModal = (state: ModalStore) => state.modal;
