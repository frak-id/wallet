import type { Hex } from "viem";
import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../tests/vitest-fixtures";
import type { PendingInteraction } from "../types/Interaction";
import type { InteractionSession } from "../types/Session";
import {
    selectInteractionSession,
    selectPendingInteractions,
    selectPendingInteractionsArray,
    walletStore,
} from "./walletStore";

// Helper to create mock PendingInteraction
const createMockInteraction = (productId: string): PendingInteraction => ({
    productId: productId as Hex,
    interaction: {
        handlerTypeDenominator: "0x01" as Hex,
        interactionData: "0x123456" as Hex,
    },
    timestamp: Date.now(),
});

describe("walletStore", () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        walletStore.getState().clearWallet();
    });

    describe("initial state", () => {
        test("should have correct initial values", () => {
            const state = walletStore.getState();

            expect(state.interactionSession).toBeNull();
            expect(state.pendingInteractions).toEqual({ interactions: [] });
        });
    });

    describe("setInteractionSession", () => {
        test("should set interaction session", () => {
            const mockSession: InteractionSession = {
                sessionStart: Date.now(),
                sessionEnd: Date.now() + 3600000, // 1 hour later
            };

            walletStore.getState().setInteractionSession(mockSession);
            expect(walletStore.getState().interactionSession).toEqual(
                mockSession
            );
        });

        test("should clear interaction session when null", () => {
            const mockSession: InteractionSession = {
                sessionStart: Date.now(),
                sessionEnd: Date.now() + 3600000,
            };

            walletStore.getState().setInteractionSession(mockSession);
            walletStore.getState().setInteractionSession(null);
            expect(walletStore.getState().interactionSession).toBeNull();
        });

        test("should work with selector", () => {
            const mockSession: InteractionSession = {
                sessionStart: Date.now(),
                sessionEnd: Date.now() + 3600000,
            };

            walletStore.getState().setInteractionSession(mockSession);
            expect(selectInteractionSession(walletStore.getState())).toEqual(
                mockSession
            );
        });
    });

    describe("addPendingInteraction", () => {
        test("should add a single pending interaction", () => {
            const mockInteraction = createMockInteraction("product-123");

            walletStore.getState().addPendingInteraction(mockInteraction);

            const interactions =
                walletStore.getState().pendingInteractions.interactions;
            expect(interactions).toHaveLength(1);
            expect(interactions[0]).toEqual(mockInteraction);
        });

        test("should add multiple interactions sequentially", () => {
            const interaction1 = createMockInteraction("product-1");
            const interaction2 = createMockInteraction("product-2");

            walletStore.getState().addPendingInteraction(interaction1);
            walletStore.getState().addPendingInteraction(interaction2);

            const interactions =
                walletStore.getState().pendingInteractions.interactions;
            expect(interactions).toHaveLength(2);
        });

        test("should filter out duplicate interactions", () => {
            const interaction = createMockInteraction("product-123");

            // Add the same interaction twice
            walletStore.getState().addPendingInteraction(interaction);
            walletStore.getState().addPendingInteraction(interaction);

            const interactions =
                walletStore.getState().pendingInteractions.interactions;
            // Should only have one interaction (duplicate filtered)
            expect(interactions).toHaveLength(1);
        });
    });

    describe("addPendingInteractions", () => {
        test("should add multiple interactions at once", () => {
            const interactions: PendingInteraction[] = [
                createMockInteraction("product-1"),
                createMockInteraction("product-2"),
                createMockInteraction("product-3"),
            ];

            walletStore.getState().addPendingInteractions(interactions);

            const stored =
                walletStore.getState().pendingInteractions.interactions;
            expect(stored).toHaveLength(3);
        });

        test("should merge with existing interactions", () => {
            const existing = createMockInteraction("product-1");
            const newInteractions: PendingInteraction[] = [
                createMockInteraction("product-2"),
                createMockInteraction("product-3"),
            ];

            walletStore.getState().addPendingInteraction(existing);
            walletStore.getState().addPendingInteractions(newInteractions);

            const stored =
                walletStore.getState().pendingInteractions.interactions;
            expect(stored).toHaveLength(3);
        });

        test("should filter duplicate interactions in batch", () => {
            const interaction1 = createMockInteraction("product-1");
            const interactions: PendingInteraction[] = [
                interaction1,
                interaction1, // Duplicate
                createMockInteraction("product-2"),
            ];

            walletStore.getState().addPendingInteractions(interactions);

            const stored =
                walletStore.getState().pendingInteractions.interactions;
            // Should filter duplicate
            expect(stored).toHaveLength(2);
        });

        test("should handle empty array", () => {
            walletStore.getState().addPendingInteractions([]);

            const stored =
                walletStore.getState().pendingInteractions.interactions;
            expect(stored).toHaveLength(0);
        });
    });

    describe("cleanPendingInteractions", () => {
        test("should clear all pending interactions", () => {
            const interactions: PendingInteraction[] = [
                createMockInteraction("product-1"),
                createMockInteraction("product-2"),
            ];

            walletStore.getState().addPendingInteractions(interactions);
            walletStore.getState().cleanPendingInteractions();

            const stored =
                walletStore.getState().pendingInteractions.interactions;
            expect(stored).toHaveLength(0);
        });

        test("should reset to empty interactions array", () => {
            walletStore.getState().cleanPendingInteractions();

            expect(walletStore.getState().pendingInteractions).toEqual({
                interactions: [],
            });
        });
    });

    describe("clearWallet", () => {
        test("should clear all wallet data", () => {
            const mockSession: InteractionSession = {
                sessionStart: Date.now(),
                sessionEnd: Date.now() + 3600000,
            };
            const mockInteractions: PendingInteraction[] = [
                createMockInteraction("product-1"),
            ];

            // Set values
            walletStore.getState().setInteractionSession(mockSession);
            walletStore.getState().addPendingInteractions(mockInteractions);

            // Clear
            walletStore.getState().clearWallet();

            // Verify all cleared
            const state = walletStore.getState();
            expect(state.interactionSession).toBeNull();
            expect(state.pendingInteractions.interactions).toHaveLength(0);
        });
    });

    describe("selectors", () => {
        test("should select interaction session", () => {
            const mockSession: InteractionSession = {
                sessionStart: Date.now(),
                sessionEnd: Date.now() + 3600000,
            };

            walletStore.getState().setInteractionSession(mockSession);

            expect(selectInteractionSession(walletStore.getState())).toEqual(
                mockSession
            );
        });

        test("should select pending interactions object", () => {
            const interactions: PendingInteraction[] = [
                createMockInteraction("product-1"),
            ];

            walletStore.getState().addPendingInteractions(interactions);

            const result = selectPendingInteractions(walletStore.getState());
            expect(result).toEqual({ interactions });
        });

        test("should select pending interactions array", () => {
            const interactions: PendingInteraction[] = [
                createMockInteraction("product-1"),
                createMockInteraction("product-2"),
            ];

            walletStore.getState().addPendingInteractions(interactions);

            const result = selectPendingInteractionsArray(
                walletStore.getState()
            );
            expect(result).toHaveLength(2);
            expect(result).toEqual(interactions);
        });

        test("should return empty array when no pending interactions", () => {
            const result = selectPendingInteractionsArray(
                walletStore.getState()
            );
            expect(result).toEqual([]);
        });
    });

    describe("interaction deduplication", () => {
        test("should deduplicate based on interaction content hash", () => {
            const interaction: PendingInteraction = {
                productId: "0x123" as Hex,
                interaction: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0x123456" as Hex,
                },
                timestamp: 1234567890,
            };

            // Add the same interaction twice
            walletStore.getState().addPendingInteraction(interaction);
            walletStore.getState().addPendingInteraction(interaction);

            const interactions =
                walletStore.getState().pendingInteractions.interactions;
            expect(interactions).toHaveLength(1);
        });

        test("should keep interactions with different content", () => {
            const interaction1: PendingInteraction = {
                productId: "0x123" as Hex,
                interaction: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0x123456" as Hex,
                },
                timestamp: 1234567890,
            };

            const interaction2: PendingInteraction = {
                productId: "0x123" as Hex,
                interaction: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0xabcdef" as Hex, // Different data
                },
                timestamp: 1234567890,
            };

            walletStore.getState().addPendingInteraction(interaction1);
            walletStore.getState().addPendingInteraction(interaction2);

            const interactions =
                walletStore.getState().pendingInteractions.interactions;
            expect(interactions).toHaveLength(2);
        });
    });
});
