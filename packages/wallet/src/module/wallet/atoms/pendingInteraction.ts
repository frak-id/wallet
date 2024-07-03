import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai/index";
import { atomWithStorage } from "jotai/utils";
import type { Hex } from "viem";

type PendingInteraction = {
    contentId: Hex;
    interaction: PreparedInteraction;
    signature?: Hex;
};

type PendingInteractionsStorage = {
    interactions: PendingInteraction[];
};

/**
 * Atom representing the pending interactions
 */
export const pendingInteractionAtom =
    atomWithStorage<PendingInteractionsStorage>("pendingInteractions", {
        interactions: [],
    });

/**
 * Add an interaction to the pending interactions
 */
export const addPendingInteractionAtom = atom(
    null,
    (_get, set, pInteraction: PendingInteraction) => {
        set(pendingInteractionAtom, (prev) => ({
            interactions: [...prev.interactions, pInteraction],
        }));
    }
);

/**
 * Clean the pending interactions
 */
export const cleanPendingInteractionsAtom = atom(null, (_get, set) => {
    set(pendingInteractionAtom, { interactions: [] });
});
