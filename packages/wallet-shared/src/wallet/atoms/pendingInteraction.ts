import type { PendingInteraction } from "@frak-labs/wallet-shared/types/Interaction";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { unique } from "radash";
import { sha256, stringToHex } from "viem";

type PendingInteractionsStorage = {
    interactions: PendingInteraction[];
};

/**
 * Atom representing the pending interactions
 */
export const pendingInteractionAtom =
    atomWithStorage<PendingInteractionsStorage>("frak_pendingInteractions", {
        interactions: [],
    });

/**
 * Add an interaction to the pending interactions
 */
export const addPendingInteractionAtom = atom(
    null,
    (_get, set, pInteraction: PendingInteraction) => {
        set(pendingInteractionAtom, (prev) => {
            const newInteractions = [...prev.interactions, pInteraction];
            return {
                interactions: filterDuplicateInteractions(newInteractions),
            };
        });
    }
);

/**
 * Add a list of pending interactions to our storage
 */
export const addPendingInteractionsAtom = atom(
    null,
    (_get, set, pInteractions: PendingInteraction[]) => {
        set(pendingInteractionAtom, (prev) => {
            const newInteractions = [...prev.interactions, ...pInteractions];
            return {
                interactions: filterDuplicateInteractions(newInteractions),
            };
        });
    }
);

const filterDuplicateInteractions = (
    interactions: PendingInteraction[]
): PendingInteraction[] =>
    unique(interactions, (interaction) =>
        sha256(stringToHex(JSON.stringify(interaction)))
    );

/**
 * Clean the pending interactions
 */
export const cleanPendingInteractionsAtom = atom(null, (_get, set) => {
    set(pendingInteractionAtom, { interactions: [] });
});
