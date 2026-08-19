import { INSTALL_TICKET_TTL_MS } from "@frak-labs/app-essentials/constants/installTicket";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    PendingAction,
    PendingActionInput,
} from "@/module/pending-actions/types";

const DEFAULT_NAV_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_ENSURE_TTL_MS = INSTALL_TICKET_TTL_MS;

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
 * Dedup key for an action. Prefers the ticket when present: a ticket is
 * per-`resolve` call, not per-identity, so two resolves for the same
 * `anonymousId` are distinct pending actions rather than overwriting each
 * other. Falls back to the legacy `anonymousId`-keyed form.
 *
 * ROLLOUT-STEP-3: this branch runs dry once ENSURE_BARE_ARM_ENABLED is
 * disabled and the queued bare actions have drained.
 */
function dedupeKey(action: PendingActionInput): string {
    switch (action.type) {
        case "ensure":
            if (action.ticket) {
                return `ensure:${action.merchantId}:${action.ticket}`;
            }
            // Legacy anonymousId-keyed dedupe, drains with the bare arm.
            return `ensure:${action.merchantId}:${action.anonymousId}`;
        case "navigation":
            return "navigation";
    }
}

/**
 * Default TTL by action type.
 *   - navigation: 10 minutes (stale deep links should expire quickly)
 *   - ensure: one week (referral attribution must survive download + onboarding)
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
 * Unified store for all deferred post-auth actions. Persisted in
 * localStorage, deduplicated by type + key fields, auto-prunes expired
 * actions on read.
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
            version: 1,
            partialize: (state) => ({
                actions: state.actions,
            }),
            /**
             * MUST NOT THROW: an unversioned persisted store is treated as
             * version `0` by zustand's `persist`, which always calls
             * `migrate` — including for the `navigation` actions this same
             * store backs. A malformed or unrecognised `persistedState`
             * degrades to `initialState` instead of throwing.
             */
            migrate: (persistedState) => {
                const state = persistedState as
                    | Partial<PendingActionsState>
                    | undefined;
                if (!state || !Array.isArray(state.actions)) {
                    return { actions: [] };
                }
                return { actions: state.actions };
            },
        }
    )
);
