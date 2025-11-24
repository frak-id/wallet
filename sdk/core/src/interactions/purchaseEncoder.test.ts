/**
 * Tests for PurchaseInteractionEncoder
 * Tests encoding of purchase-related user interactions
 */

import type { Hex } from "viem";
import { encodeAbiParameters, pad, toHex } from "viem";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { PurchaseInteractionEncoder } from "./purchaseEncoder";

describe("PurchaseInteractionEncoder", () => {
    describe("startPurchase", () => {
        test("should encode start purchase interaction with correct structure", ({
            mockPurchaseId,
        }) => {
            const interaction = PurchaseInteractionEncoder.startPurchase({
                purchaseId: mockPurchaseId,
            });

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        test("should use purchase product type in handlerTypeDenominator", ({
            mockPurchaseId,
        }) => {
            const interaction = PurchaseInteractionEncoder.startPurchase({
                purchaseId: mockPurchaseId,
            });

            // Should use purchase product type (31)
            const expectedDenominator = toHex(productTypes.purchase);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        test("should include started interaction type in data", ({
            mockPurchaseId,
        }) => {
            const interaction = PurchaseInteractionEncoder.startPurchase({
                purchaseId: mockPurchaseId,
            });

            // Should start with started interaction type
            expect(interaction.interactionData).toContain(
                interactionTypes.purchase.started
            );
        });

        test("should pad purchase ID to 32 bytes", ({ mockPurchaseId }) => {
            const interaction = PurchaseInteractionEncoder.startPurchase({
                purchaseId: mockPurchaseId,
            });

            // Purchase ID should be padded to 32 bytes
            const paddedPurchaseId = pad(mockPurchaseId, { size: 32 });
            expect(interaction.interactionData).toContain(
                paddedPurchaseId.slice(2)
            );
        });

        test("should produce consistent output for same purchase ID", ({
            mockPurchaseId,
        }) => {
            const interaction1 = PurchaseInteractionEncoder.startPurchase({
                purchaseId: mockPurchaseId,
            });
            const interaction2 = PurchaseInteractionEncoder.startPurchase({
                purchaseId: mockPurchaseId,
            });

            // Same input should produce same output
            expect(interaction1).toEqual(interaction2);
        });
    });

    describe("completedPurchase", () => {
        test("should encode completed purchase with proof", ({
            mockPurchaseId,
            mockProof,
        }) => {
            const interaction = PurchaseInteractionEncoder.completedPurchase({
                purchaseId: mockPurchaseId,
                proof: mockProof,
            });

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        test("should use purchase product type in handlerTypeDenominator", ({
            mockPurchaseId,
            mockProof,
        }) => {
            const interaction = PurchaseInteractionEncoder.completedPurchase({
                purchaseId: mockPurchaseId,
                proof: mockProof,
            });

            // Should use purchase product type (31)
            const expectedDenominator = toHex(productTypes.purchase);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        test("should include completed interaction type in data", ({
            mockPurchaseId,
            mockProof,
        }) => {
            const interaction = PurchaseInteractionEncoder.completedPurchase({
                purchaseId: mockPurchaseId,
                proof: mockProof,
            });

            // Should start with completed interaction type
            expect(interaction.interactionData).toContain(
                interactionTypes.purchase.completed
            );
        });

        test("should use ABI encoding for inner data", ({
            mockPurchaseId,
            mockProof,
        }) => {
            const interaction = PurchaseInteractionEncoder.completedPurchase({
                purchaseId: mockPurchaseId,
                proof: mockProof,
            });

            // Inner data should be ABI encoded (uint256 + bytes32[])
            const expectedInnerData = encodeAbiParameters(
                [{ type: "uint256" }, { type: "bytes32[]" }],
                [BigInt(mockPurchaseId), mockProof]
            );
            expect(interaction.interactionData).toContain(
                expectedInnerData.slice(2)
            );
        });

        test("should handle empty proof array", ({ mockPurchaseId }) => {
            const interaction = PurchaseInteractionEncoder.completedPurchase({
                purchaseId: mockPurchaseId,
                proof: [],
            });

            // Should still encode properly with empty proof
            expect(interaction.interactionData).toBeDefined();
            expect(interaction.handlerTypeDenominator).toBe(
                toHex(productTypes.purchase)
            );
        });

        test("should handle multiple proof elements", ({ mockPurchaseId }) => {
            const largeProof: Hex[] = [
                "0x0000000000000000000000000000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000000000000000000000000000002",
                "0x0000000000000000000000000000000000000000000000000000000000000003",
                "0x0000000000000000000000000000000000000000000000000000000000000004",
                "0x0000000000000000000000000000000000000000000000000000000000000005",
            ];

            const interaction = PurchaseInteractionEncoder.completedPurchase({
                purchaseId: mockPurchaseId,
                proof: largeProof,
            });

            // Should handle larger proof arrays
            expect(interaction.interactionData).toBeDefined();
            expect(interaction.handlerTypeDenominator).toBe(
                toHex(productTypes.purchase)
            );
        });
    });

    describe("unsafeCompletedPurchase", () => {
        test("should encode unsafe completed purchase", ({
            mockPurchaseId,
        }) => {
            const interaction =
                PurchaseInteractionEncoder.unsafeCompletedPurchase({
                    purchaseId: mockPurchaseId,
                });

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        test("should use purchase product type in handlerTypeDenominator", ({
            mockPurchaseId,
        }) => {
            const interaction =
                PurchaseInteractionEncoder.unsafeCompletedPurchase({
                    purchaseId: mockPurchaseId,
                });

            // Should use purchase product type (31)
            const expectedDenominator = toHex(productTypes.purchase);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        test("should include unsafeCompleted interaction type in data", ({
            mockPurchaseId,
        }) => {
            const interaction =
                PurchaseInteractionEncoder.unsafeCompletedPurchase({
                    purchaseId: mockPurchaseId,
                });

            // Should start with unsafeCompleted interaction type
            expect(interaction.interactionData).toContain(
                interactionTypes.purchase.unsafeCompleted
            );
        });

        test("should pad purchase ID to 32 bytes", ({ mockPurchaseId }) => {
            const interaction =
                PurchaseInteractionEncoder.unsafeCompletedPurchase({
                    purchaseId: mockPurchaseId,
                });

            // Purchase ID should be padded to 32 bytes
            const paddedPurchaseId = pad(mockPurchaseId, { size: 32 });
            expect(interaction.interactionData).toContain(
                paddedPurchaseId.slice(2)
            );
        });

        test("should differ from safe completed purchase", ({
            mockPurchaseId,
        }) => {
            const safeInteraction =
                PurchaseInteractionEncoder.completedPurchase({
                    purchaseId: mockPurchaseId,
                    proof: [],
                });
            const unsafeInteraction =
                PurchaseInteractionEncoder.unsafeCompletedPurchase({
                    purchaseId: mockPurchaseId,
                });

            // Unsafe and safe versions should be different
            expect(unsafeInteraction.interactionData).not.toBe(
                safeInteraction.interactionData
            );
        });
    });

    describe("interaction data format", () => {
        test("should produce valid hex strings", ({ mockPurchaseId }) => {
            const startInteraction = PurchaseInteractionEncoder.startPurchase({
                purchaseId: mockPurchaseId,
            });
            const unsafeInteraction =
                PurchaseInteractionEncoder.unsafeCompletedPurchase({
                    purchaseId: mockPurchaseId,
                });

            // Both should be valid hex strings starting with 0x
            expect(startInteraction.interactionData).toMatch(/^0x[0-9a-f]+$/);
            expect(unsafeInteraction.interactionData).toMatch(/^0x[0-9a-f]+$/);
        });

        test("should handle different purchase IDs correctly", () => {
            const purchaseId1 =
                "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
            const purchaseId2 =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as const;

            const interaction1 = PurchaseInteractionEncoder.startPurchase({
                purchaseId: purchaseId1,
            });
            const interaction2 = PurchaseInteractionEncoder.startPurchase({
                purchaseId: purchaseId2,
            });

            // Different purchase IDs should produce different interaction data
            expect(interaction1.interactionData).not.toBe(
                interaction2.interactionData
            );
        });
    });
});
