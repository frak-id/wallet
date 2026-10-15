import { recordError } from "@frak-labs/wallet-shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MONERIUM_STORE_NAME = "frak_monerium_store";

type MoneriumStoreState = {
    hasSeenSetupSuccess: boolean;

    markSetupSuccessSeen: () => void;
    reset: () => void;
};

type PersistedMoneriumState = Pick<MoneriumStoreState, "hasSeenSetupSuccess">;

const initialPersistedState: PersistedMoneriumState = {
    hasSeenSetupSuccess: false,
};

/**
 * Runs on every hydration, so a payload anyone can write never reaches the
 * store: anything but the known boolean yields the initial slice, and
 * unknown keys (the tokens a v1 payload held) are dropped.
 */
function pickPersistedState(value: unknown): PersistedMoneriumState {
    if (typeof value !== "object" || value === null) {
        return initialPersistedState;
    }
    const { hasSeenSetupSuccess } = value as Record<string, unknown>;
    return typeof hasSeenSetupSuccess === "boolean"
        ? { hasSeenSetupSuccess }
        : initialPersistedState;
}

export const moneriumStore = create<MoneriumStoreState>()(
    persist(
        (set) => ({
            ...initialPersistedState,

            markSetupSuccessSeen: () => set({ hasSeenSetupSuccess: true }),
            reset: () => set(initialPersistedState),
        }),
        {
            name: MONERIUM_STORE_NAME,
            version: 2,
            partialize: (state: MoneriumStoreState) =>
                pickPersistedState(state),
            // The migrated value is written back to localStorage, which is
            // what erases the tokens a v1 payload held.
            migrate: (persistedState) => pickPersistedState(persistedState),
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...pickPersistedState(persistedState),
            }),
            onRehydrateStorage: () => (_state, error) => {
                if (error) {
                    recordError(error, { source: "monerium_store_rehydrate" });
                }
            },
        }
    )
);
