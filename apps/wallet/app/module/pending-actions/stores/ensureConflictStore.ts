import { create } from "zustand";

type EnsureConflictStore = {
    /** A pending ensure failed permanently and has not been acknowledged yet. */
    raised: boolean;
    raise: () => void;
    dismiss: () => void;
};

/**
 * Signals that a pending `ensure` action failed with a non-retryable
 * WALLET_ALREADY_LINKED conflict (README §3.8).
 *
 * A module store rather than component state, because the ensure calls are
 * fire-and-forget and every caller of `useExecutePendingActions` navigates
 * away immediately — the rejection lands after the calling component has
 * unmounted. Deliberately not persisted: the user is told once, on the
 * launch where it happened, and the pending action is dropped so it cannot
 * recur.
 */
export const ensureConflictStore = create<EnsureConflictStore>()((set) => ({
    raised: false,
    raise: () => set({ raised: true }),
    dismiss: () => set({ raised: false }),
}));
