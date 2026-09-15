import { create } from "zustand";

type ModalErrorStore = {
    /** A modal failed to load and the user has not acknowledged it yet. */
    raised: boolean;
    raise: () => void;
    dismiss: () => void;
};

/**
 * One unacknowledged flag: a lazy modal chunk failed to fetch (a stale client
 * after a deploy), and the modal is already closed by the time it is raised.
 * Read only by `ModalErrorToast` inside `AppShell`, so a shell-less route
 * under `_wallet` would lose the signal.
 */
export const modalErrorStore = create<ModalErrorStore>()((set) => ({
    raised: false,
    raise: () => set({ raised: true }),
    dismiss: () => set({ raised: false }),
}));
