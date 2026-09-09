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

export const PENDING_ACTIONS_STORE_NAME = "frak_pending_actions_store";

/**
 * A persisted entry is only usable if every field the store reads back is
 * present and the right type. `expiresAt` in particular is read unguarded
 * by `getValidActions`, and `to` is passed straight to `navigate`.
 */
function isPendingAction(value: unknown): value is PendingAction {
    if (typeof value !== "object" || value === null) return false;
    const action = value as Record<string, unknown>;
    if (
        typeof action.id !== "string" ||
        typeof action.createdAt !== "number" ||
        typeof action.expiresAt !== "number"
    ) {
        return false;
    }
    if (action.type === "ensure") return typeof action.merchantId === "string";
    // A `to` from storage becomes a post-auth redirect target, so only an
    // in-app absolute path is accepted — never a scheme or protocol-relative
    // URL, which would navigate the user off-origin.
    if (action.type === "navigation") {
        return (
            typeof action.to === "string" &&
            action.to.startsWith("/") &&
            !action.to.startsWith("//")
        );
    }
    return false;
}

/**
 * Picks the persisted slice out of whatever localStorage held. Runs on
 * every hydration, so unknown keys never reach the store's actions and a
 * malformed entry is dropped rather than handed to a consumer.
 */
function pickPersistedState(value: unknown): PendingActionsState {
    if (typeof value !== "object" || value === null) return initialState;
    const { actions } = value as { actions?: unknown };
    if (!Array.isArray(actions)) return initialState;
    return { actions: actions.filter(isPendingAction) };
}

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
            name: PENDING_ACTIONS_STORE_NAME,
            version: 1,
            partialize: (state: PendingActionsStore) =>
                pickPersistedState(state),
            // Without `migrate` a v0 payload is discarded, dropping a
            // referral attribution the user already earned. `migrate` only
            // runs when the stored version differs, so validation lives in
            // `merge`, which runs on every hydration.
            migrate: (persistedState) => persistedState,
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...pickPersistedState(persistedState),
            }),
        }
    )
);
