import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * A single known beneficiary IBAN, locally managed by the user.
 */
export type IbanEntry = {
    iban: string;
    name: string;
};

type IbanStoreState = {
    /**
     * List of IBANs the user has saved as known beneficiaries.
     */
    knownIbans: IbanEntry[];
    /**
     * Last IBAN used for an offramp transfer (raw string).
     * Used to resolve the "default" IBAN for the next transfer.
     */
    lastUsedIban: string | null;

    addIban: (entry: IbanEntry) => void;
    removeIban: (iban: string) => void;
    setLastUsedIban: (iban: string | null) => void;
    clearIbans: () => void;
};

/**
 * Zustand store managing the locally known IBANs for Monerium offramp transfers.
 *
 * Persists to localStorage via zustand's `persist` middleware.
 */
export const ibanStore = create<IbanStoreState>()(
    persist(
        (set) => ({
            knownIbans: [],
            lastUsedIban: null,

            addIban: (entry) =>
                set((state) => {
                    const normalized = normalizeIban(entry.iban);
                    if (normalized.length === 0) return state;

                    const trimmedName = entry.name.trim();
                    const existing = state.knownIbans.find(
                        (i) => i.iban === normalized
                    );

                    if (existing) {
                        return {
                            knownIbans: state.knownIbans.map((i) =>
                                i.iban === normalized
                                    ? { ...i, name: trimmedName || i.name }
                                    : i
                            ),
                        };
                    }

                    return {
                        knownIbans: [
                            ...state.knownIbans,
                            { iban: normalized, name: trimmedName },
                        ],
                    };
                }),

            removeIban: (iban) =>
                set((state) => {
                    const normalized = normalizeIban(iban);
                    const knownIbans = state.knownIbans.filter(
                        (i) => i.iban !== normalized
                    );
                    const lastUsedIban =
                        state.lastUsedIban === normalized
                            ? null
                            : state.lastUsedIban;
                    return { knownIbans, lastUsedIban };
                }),

            setLastUsedIban: (iban) =>
                set({
                    lastUsedIban: iban ? normalizeIban(iban) : null,
                }),

            clearIbans: () => set({ knownIbans: [], lastUsedIban: null }),
        }),
        {
            name: "frak_iban_store",
        }
    )
);

/**
 * Normalize an IBAN by stripping whitespace and upper-casing it.
 */
function normalizeIban(iban: string): string {
    return iban.replace(/\s/g, "").toUpperCase();
}

/**
 * Selector — return the full list of known IBANs.
 */
export const selectKnownIbans = (state: IbanStoreState) => state.knownIbans;

/**
 * Selector — return the raw last-used IBAN string (may be null).
 */
export const selectLastUsedIban = (state: IbanStoreState) => state.lastUsedIban;

/**
 * Selector — return the effective IBAN entry to pre-select for a new transfer.
 *
 * Resolution order:
 *   1. Last used IBAN (if still present in knownIbans)
 *   2. First IBAN in knownIbans
 *   3. null (empty store)
 */
export const selectEffectiveIban = (
    state: IbanStoreState
): IbanEntry | null => {
    if (state.knownIbans.length === 0) return null;

    if (state.lastUsedIban) {
        const match = state.knownIbans.find(
            (i) => i.iban === state.lastUsedIban
        );
        if (match) return match;
    }

    return state.knownIbans[0] ?? null;
};

/**
 * Selector — true when no IBAN has been saved yet.
 */
export const selectHasNoIban = (state: IbanStoreState) =>
    state.knownIbans.length === 0;
