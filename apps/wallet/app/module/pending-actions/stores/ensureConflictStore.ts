import { create } from "zustand";

type EnsureConflictStore = {
    /** A pending ensure failed permanently and has not been acknowledged yet. */
    raised: boolean;
    raise: () => void;
    dismiss: () => void;
};

/**
 * Signals that a pending `ensure` failed with a non-retryable
 * `WALLET_ALREADY_LINKED` conflict.
 *
 * A module store rather than component state: the ensure calls are
 * fire-and-forget and every caller navigates away before the rejection
 * lands. Not persisted — the user is told once, on the launch where it
 * happened.
 */
export const ensureConflictStore = create<EnsureConflictStore>()((set) => ({
    raised: false,
    raise: () => set({ raised: true }),
    dismiss: () => set({ raised: false }),
}));
