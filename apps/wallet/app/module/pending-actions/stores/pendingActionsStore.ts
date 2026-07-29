import { INSTALL_TICKET_TTL_MS } from "@frak-labs/app-essentials/constants/installTicket";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    PendingAction,
    PendingActionInput,
} from "@/module/pending-actions/types";

const DEFAULT_NAV_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Shared with the install-ticket JWT the ensure action carries, so the two
// can never expire out of step.
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
 * Deduplication key for an action — prevents duplicate entries
 * of the same type with the same parameters.
 *
 * Prefers the ticket when present: a ticket is per-`resolve` call, not
 * per-identity (README §5 ticket design table), so two resolves for the
 * same `anonymousId` (e.g. the user re-enters a code) are distinct pending
 * actions rather than overwriting each other. Falls back to the legacy
 * `anonymousId`-keyed form — tag kept for ROLLOUT-STEP-3: once the bare
 * `anonymousId` arm is deleted this branch has no more actions to key.
 */
function dedupeKey(action: PendingActionInput): string {
    switch (action.type) {
        case "ensure":
            if (action.ticket) {
                return `ensure:${action.merchantId}:${action.ticket}`;
            }
            // ROLLOUT-STEP-3: legacy anonymousId-keyed dedupe.
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
            version: 1,
            partialize: (state) => ({
                actions: state.actions,
            }),
            /**
             * README §5 step 1: add `version`/`migrate` now, while the
             * migration is a no-op, so a future `version: 2` (dropping
             * `anonymousId` per ROLLOUT-STEP-3) has a hook to land on.
             *
             * MUST NOT THROW. A store persisted by any build before this
             * change has no `version` field at all — zustand's `persist`
             * treats that as version `0` and always calls `migrate`, even
             * though the persisted shape stays readable as-is: the only
             * `PendingAction` change shipping alongside this bump is the
             * OPTIONAL `proof` field, which an older payload simply omits,
             * so no field-level migration is required here.
             * The SAME store also backs `navigation` actions used by
             * pairing and deep links (README §6.1); a thrown migration
             * would corrupt rehydration for those too, not just `ensure`.
             * A malformed or unrecognised `persistedState` degrades to the
             * store's own `initialState` rather than throwing, so a
             * corrupted payload just re-derives pending actions on the next
             * real event instead of bricking the whole store.
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
