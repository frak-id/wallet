import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    PendingAction,
    PendingActionInput,
} from "@/module/pending-actions/types";

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

type PendingActionsState = {
    actions: PendingAction[];
};

type PendingActionsActions = {
    addAction: (action: PendingActionInput, ttlMs?: number) => void;
    removeAction: (id: string) => void;
    getValidActions: () => PendingAction[];
    clearPendingPairing: () => void;
    clearAll: () => void;
};

type PendingActionsStore = PendingActionsState & PendingActionsActions;

const initialState: PendingActionsState = {
    actions: [],
};

/**
 * Deduplication key for an action — prevents duplicate entries
 * of the same type with the same parameters.
 */
function dedupeKey(action: PendingActionInput): string {
    switch (action.type) {
        case "ensure":
            return `ensure:${action.merchantId}:${action.anonymousId}`;
        case "navigation":
            return `navigation:${action.to}`;
    }
}

/**
 * Unified store for all deferred post-auth actions.
 *
 * Replaces:
 *   - installCodeStore (pending install codes → ensure actions)
 *   - pendingDeepLink variable (volatile deep link → navigation actions)
 *   - pairingStore.pendingPairingId (pending pairing → navigation actions)
 *
 * Persisted in localStorage so actions survive page refreshes.
 * Auto-deduplicates by type + key fields.
 * Auto-prunes expired actions on read.
 */
export const pendingActionsStore = create<PendingActionsStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            addAction: (input, ttlMs = DEFAULT_TTL_MS) => {
                const now = Date.now();
                const key = dedupeKey(input);
                set((state) => {
                    // Remove expired actions + duplicates of the same key
                    const filtered = state.actions.filter(
                        (a) => a.expiresAt > now && dedupeKey(a) !== key
                    );
                    return {
                        actions: [
                            ...filtered,
                            {
                                ...input,
                                id: crypto.randomUUID(),
                                createdAt: now,
                                expiresAt: now + ttlMs,
                            },
                        ],
                    };
                });
            },

            removeAction: (id) => {
                set((state) => ({
                    actions: state.actions.filter((a) => a.id !== id),
                }));
            },

            getValidActions: () => {
                const now = Date.now();
                const { actions } = get();
                const valid = actions.filter((a) => a.expiresAt > now);

                // Prune expired actions if any were removed
                if (valid.length !== actions.length) {
                    set({ actions: valid });
                }

                return valid;
            },

            clearPendingPairing: () => {
                set((state) => ({
                    actions: state.actions.filter(
                        (a) => !(a.type === "navigation" && a.to === "/pairing")
                    ),
                }));
            },

            clearAll: () => set(initialState),
        }),
        {
            name: "frak_pending_actions_store",
            partialize: (state) => ({
                actions: state.actions,
            }),
        }
    )
);

/**
 * Selectors
 */
export const selectPendingActions = (state: PendingActionsStore) =>
    state.actions;

export const selectHasPendingActions = (state: PendingActionsStore) =>
    state.actions.length > 0;

export const selectPendingPairingId = (
    state: PendingActionsStore
): string | null => {
    const now = Date.now();
    const action = state.actions.find(
        (a) =>
            a.type === "navigation" && a.to === "/pairing" && a.expiresAt > now
    );
    return action?.type === "navigation" ? (action.search?.id ?? null) : null;
};
