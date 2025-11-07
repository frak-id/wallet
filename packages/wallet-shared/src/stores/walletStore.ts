/**
 * Zustand store for wallet management
 */

import { noopStorage } from "@wagmi/core";
import { unique } from "radash";
import { sha256, stringToHex } from "viem";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PendingInteraction } from "../types/Interaction";
import type { WalletStore } from "./types";

/**
 * Filter duplicate interactions using hash comparison
 */
const filterDuplicateInteractions = (
    interactions: PendingInteraction[]
): PendingInteraction[] =>
    unique(interactions, (interaction) =>
        sha256(stringToHex(JSON.stringify(interaction)))
    );

/**
 * Wallet store managing interaction sessions and pending interactions
 * Uses persist middleware with SSR-safe storage
 */
export const walletStore = create<WalletStore>()(
    persist(
        (set) => ({
            // Initial state
            interactionSession: null,
            pendingInteractions: {
                interactions: [],
            },

            // Actions
            setInteractionSession: (interactionSession) =>
                set({ interactionSession }),

            addPendingInteraction: (interaction) =>
                set((state) => ({
                    pendingInteractions: {
                        interactions: filterDuplicateInteractions([
                            ...state.pendingInteractions.interactions,
                            interaction,
                        ]),
                    },
                })),

            addPendingInteractions: (interactions) =>
                set((state) => ({
                    pendingInteractions: {
                        interactions: filterDuplicateInteractions([
                            ...state.pendingInteractions.interactions,
                            ...interactions,
                        ]),
                    },
                })),

            cleanPendingInteractions: () =>
                set({
                    pendingInteractions: { interactions: [] },
                }),

            clearWallet: () =>
                set({
                    interactionSession: null,
                    pendingInteractions: { interactions: [] },
                }),
        }),
        {
            name: "frak_wallet_store",
            storage: createJSONStorage(() =>
                typeof window !== "undefined" ? localStorage : noopStorage
            ),
            partialize: (state) => ({
                interactionSession: state.interactionSession,
                pendingInteractions: state.pendingInteractions,
            }),
        }
    )
);

/**
 * Selector functions for computed values
 */

// Get the interaction session
export const selectInteractionSession = (state: WalletStore) =>
    state.interactionSession;

// Get pending interactions
export const selectPendingInteractions = (state: WalletStore) =>
    state.pendingInteractions;

// Get the pending interactions array
export const selectPendingInteractionsArray = (state: WalletStore) =>
    state.pendingInteractions.interactions;
