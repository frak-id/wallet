import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    PendingAction,
    PendingActionInput,
} from "@/module/pending-actions/types";

const DEFAULT_NAV_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_ENSURE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // One week

type PendingActionsState = {
    actions: PendingAction[];
};

type PendingActionsActions = {
    addAction: (action: PendingActionInput, ttlMs?: number) => void;
    removeAction: (id: string) => void;
    getValidActions: () => PendingAction[];
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
            return "navigation";
    }
}

/**
 * Default TTL by action type.
 *   - navigation: 10 minutes (stale deep links should expire quickly)
 *   - ensure: 24 hours (referral attribution must survive download + onboarding)
 */
function defaultTtl(action: PendingActionInput): number {
    switch (action.type) {
        case "ensure":
            return DEFAULT_ENSURE_TTL_MS;
        case "navigation":
            return DEFAULT_NAV_TTL_MS;
    }
}

/**
 * Unified store for all deferred post-auth actions.
 *
 * Replaces:
 *   - installCodeStore (pending install codes → ensure actions)
 *   - pendingDeepLink variable (volatile deep link → navigation actions)
 *   - pairingStore.pendingPairingId (pending pairing → removed, now query param)
 *
 * Persisted in localStorage so actions survive page refreshes.
 * Auto-deduplicates by type + key fields.
 * Auto-prunes expired actions on read.
 */
export const pendingActionsStore = create<PendingActionsStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            addAction: (input, ttlMs) => {
                const now = Date.now();
                const key = dedupeKey(input);
                const ttl = ttlMs ?? defaultTtl(input);
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
                                expiresAt: now + ttl,
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
