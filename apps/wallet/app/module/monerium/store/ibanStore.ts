import { normalizeIban } from "@frak-labs/app-essentials/monerium";
import type { Address } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const IBAN_STORE_NAME = "frak_iban_store";

/**
 * A beneficiary IBAN saved on this device. `pseudo` is the list label.
 * `own` payouts carry no names or country; `country` is the ISO alpha-2 code
 * of a third-party beneficiary.
 */
export type IbanEntry = {
    iban: string;
    firstName: string;
    lastName: string;
    pseudo: string;
    own: boolean;
    country?: string;
};

type IbanStoreState = {
    knownIbans: IbanEntry[];
    /** Last IBAN used for an offramp transfer, resolves the next default. */
    lastUsedIban: string | null;
    /** Wallet whose server-side beneficiaries were last merged on this device. */
    syncedWallet: Address | null;

    /** Expects a `toIbanEntry` result: normalized IBAN, trimmed names. */
    addIban: (entry: IbanEntry) => void;
    removeIban: (iban: string) => void;
    setLastUsedIban: (iban: string | null) => void;
    mergeRemoteIbans: (remote: IbanEntry[], wallet: Address) => void;
    reset: () => void;
};

/** Local entries win by normalized IBAN; remote-only ones are appended in order. */
export function mergeIbanEntries(
    local: IbanEntry[],
    remote: IbanEntry[]
): IbanEntry[] {
    const seen = new Set(local.map((entry) => normalizeIban(entry.iban)));
    const added: IbanEntry[] = [];
    for (const entry of remote) {
        const iban = normalizeIban(entry.iban);
        if (seen.has(iban)) continue;
        seen.add(iban);
        added.push({ ...entry, iban });
    }
    return [...local, ...added];
}

const initialState = {
    knownIbans: [] as IbanEntry[],
    lastUsedIban: null,
    syncedWallet: null,
};

function migrateEntries(persisted: unknown): Partial<IbanStoreState> {
    if (typeof persisted !== "object" || persisted === null) return {};
    const state = persisted as Partial<IbanStoreState>;
    const knownIbans = Array.isArray(state.knownIbans)
        ? state.knownIbans.map((entry) => ({
              ...entry,
              own: entry.own ?? false,
          }))
        : [];
    return {
        knownIbans,
        lastUsedIban: state.lastUsedIban ?? null,
        syncedWallet: state.syncedWallet ?? null,
    };
}

export const ibanStore = create<IbanStoreState>()(
    persist(
        (set) => ({
            ...initialState,

            addIban: (entry) =>
                set((state) => ({
                    knownIbans: state.knownIbans.some(
                        (i) => i.iban === entry.iban
                    )
                        ? state.knownIbans.map((i) =>
                              i.iban === entry.iban ? entry : i
                          )
                        : [...state.knownIbans, entry],
                })),

            removeIban: (iban) =>
                set((state) => {
                    const normalized = normalizeIban(iban);
                    return {
                        knownIbans: state.knownIbans.filter(
                            (i) => i.iban !== normalized
                        ),
                        lastUsedIban:
                            state.lastUsedIban === normalized
                                ? null
                                : state.lastUsedIban,
                    };
                }),

            setLastUsedIban: (iban) =>
                set({ lastUsedIban: iban ? normalizeIban(iban) : null }),

            mergeRemoteIbans: (remote, wallet) =>
                set((state) => {
                    const otherWallet =
                        state.syncedWallet !== null &&
                        state.syncedWallet.toLowerCase() !==
                            wallet.toLowerCase();
                    return {
                        knownIbans: mergeIbanEntries(
                            otherWallet ? [] : state.knownIbans,
                            remote
                        ),
                        lastUsedIban: otherWallet ? null : state.lastUsedIban,
                        syncedWallet: wallet,
                    };
                }),

            reset: () => set(initialState),
        }),
        {
            name: IBAN_STORE_NAME,
            version: 1,
            migrate: (persisted) => migrateEntries(persisted) as IbanStoreState,
            partialize: (state) => ({
                knownIbans: state.knownIbans,
                lastUsedIban: state.lastUsedIban,
                syncedWallet: state.syncedWallet,
            }),
        }
    )
);

export const selectKnownIbans = (state: IbanStoreState) => state.knownIbans;

/** Last used IBAN if still saved, else the first saved one, else null. */
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
