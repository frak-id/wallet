import { encodeAbiParameters, pad, toHex } from "viem";
import type { Hex } from "viem";
/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { PurchaseInteractionEncoder } from "./purchaseEncoder";

describe("PurchaseInteractionEncoder", () => {
    describe("startPurchase", () => {
        it("should encode a start purchase interaction correctly", () => {
            // Create a sample purchase ID
            const purchaseId = "0x123456789abcdef";

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.startPurchase({
                purchaseId,
            });

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.purchase)
            );

            // Verify the interactionData starts with the correct interaction type
            expect(
                result.interactionData.startsWith(
                    interactionTypes.purchase.started
                )
            ).toBe(true);

            // Verify the interactionData includes the padded purchaseId
            expect(
                result.interactionData.includes(
                    pad(purchaseId, { size: 32 }).slice(2)
                )
            ).toBe(true);
        });

        it("should pad short purchase IDs to 32 bytes", () => {
            // Create a very short purchase ID
            const shortPurchaseId = "0x1";

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.startPurchase({
                purchaseId: shortPurchaseId,
            });

            // Calculate the expected padded value
            const paddedPurchaseId = pad(shortPurchaseId, { size: 32 });

            // Verify that the padded ID is present in the interaction data
            expect(
                result.interactionData.includes(paddedPurchaseId.slice(2))
            ).toBe(true);

            // Verify the total length of the interaction data is correct (8 chars for type + 64 chars for 32 bytes)
            expect(result.interactionData.length).toBe(2 + 8 + 64); // 2 for '0x', 8 for interaction type, 64 for padded ID
        });

        it("should handle already 32-byte purchase IDs correctly", () => {
            // Create a full-length 32-byte purchase ID (64 hex chars after 0x)
            const fullPurchaseId = `0x${"a".repeat(64)}` as const;

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.startPurchase({
                purchaseId: fullPurchaseId,
            });

            // Verify the interaction data includes the full purchase ID without extra padding
            expect(
                result.interactionData.includes(fullPurchaseId.slice(2))
            ).toBe(true);
        });
    });

    describe("completedPurchase", () => {
        it("should encode a completed purchase interaction correctly", () => {
            // Create sample data with properly padded proof elements
            const purchaseId = "0x123456789abcdef";
            // Each proof element must be 32 bytes (64 hex chars after 0x)
            const proof: Hex[] = [
                pad("0xabc123", { size: 32 }),
                pad("0xdef456", { size: 32 }),
            ];

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.completedPurchase({
                purchaseId,
                proof,
            });

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.purchase)
            );

            // Verify the interactionData starts with the correct interaction type
            expect(
                result.interactionData.startsWith(
                    interactionTypes.purchase.completed
                )
            ).toBe(true);

            // Create the expected inner data for comparison
            const expectedInnerData = encodeAbiParameters(
                [{ type: "uint256" }, { type: "bytes32[]" }],
                [BigInt(purchaseId), proof]
            );

            // Verify the interaction data contains the encoded parameters
            expect(result.interactionData).toContain(
                expectedInnerData.slice(2)
            );
        });

        it("should handle empty proof array", () => {
            // Create sample data with empty proof array
            const purchaseId = "0x123456789abcdef";
            const proof: Hex[] = [];

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.completedPurchase({
                purchaseId,
                proof,
            });

            // Verify correct structure
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Create the expected inner data for comparison
            const expectedInnerData = encodeAbiParameters(
                [{ type: "uint256" }, { type: "bytes32[]" }],
                [BigInt(purchaseId), proof]
            );

            // Verify the interaction data contains the encoded parameters
            expect(result.interactionData).toContain(
                expectedInnerData.slice(2)
            );
        });

        it("should handle multiple proof elements", () => {
            // Create sample data with multiple proof elements, all properly padded to 32 bytes
            const purchaseId = "0x123456789abcdef";
            const proof: Hex[] = [
                pad("0xabc123", { size: 32 }),
                pad("0xdef456", { size: 32 }),
                pad("0xfff789", { size: 32 }),
                pad("0xaaa012", { size: 32 }),
            ];

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.completedPurchase({
                purchaseId,
                proof,
            });

            // Verify correct structure
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Create the expected inner data for comparison
            const expectedInnerData = encodeAbiParameters(
                [{ type: "uint256" }, { type: "bytes32[]" }],
                [BigInt(purchaseId), proof]
            );

            // Verify the interaction data contains the encoded parameters
            expect(result.interactionData).toContain(
                expectedInnerData.slice(2)
            );
        });
    });

    describe("unsafeCompletedPurchase", () => {
        it("should encode an unsafe completed purchase interaction correctly", () => {
            // Create a sample purchase ID
            const purchaseId = "0x123456789abcdef";

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.unsafeCompletedPurchase({
                purchaseId,
            });

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.purchase)
            );

            // Verify the interactionData starts with the correct interaction type
            expect(
                result.interactionData.startsWith(
                    interactionTypes.purchase.unsafeCompleted
                )
            ).toBe(true);

            // Verify the interactionData includes the padded purchaseId
            expect(
                result.interactionData.includes(
                    pad(purchaseId, { size: 32 }).slice(2)
                )
            ).toBe(true);
        });

        it("should pad short purchase IDs to 32 bytes", () => {
            // Create a very short purchase ID
            const shortPurchaseId = "0x1";

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.unsafeCompletedPurchase({
                purchaseId: shortPurchaseId,
            });

            // Calculate the expected padded value
            const paddedPurchaseId = pad(shortPurchaseId, { size: 32 });

            // Verify that the padded ID is present in the interaction data
            expect(
                result.interactionData.includes(paddedPurchaseId.slice(2))
            ).toBe(true);

            // Verify the total length of the interaction data is correct (8 chars for type + 64 chars for 32 bytes)
            expect(result.interactionData.length).toBe(2 + 8 + 64); // 2 for '0x', 8 for interaction type, 64 for padded ID
        });

        it("should handle already 32-byte purchase IDs correctly", () => {
            // Create a full-length 32-byte purchase ID (64 hex chars after 0x)
            const fullPurchaseId = `0x${"a".repeat(64)}` as const;

            // Get the prepared interaction
            const result = PurchaseInteractionEncoder.unsafeCompletedPurchase({
                purchaseId: fullPurchaseId,
            });

            // Verify the interaction data includes the full purchase ID without extra padding
            expect(
                result.interactionData.includes(fullPurchaseId.slice(2))
            ).toBe(true);
        });
    });

    describe("All encoders", () => {
        it("should produce different interaction data for the same purchase ID", () => {
            const purchaseId = "0x123456789abcdef";
            // Create a properly padded proof element
            const proof: Hex[] = [pad("0xabc123", { size: 32 })];

            const startResult = PurchaseInteractionEncoder.startPurchase({
                purchaseId,
            });
            const completedResult =
                PurchaseInteractionEncoder.completedPurchase({
                    purchaseId,
                    proof,
                });
            const unsafeResult =
                PurchaseInteractionEncoder.unsafeCompletedPurchase({
                    purchaseId,
                });

            // Verify all interaction data is different
            expect(startResult.interactionData).not.toBe(
                completedResult.interactionData
            );
            expect(startResult.interactionData).not.toBe(
                unsafeResult.interactionData
            );
            expect(completedResult.interactionData).not.toBe(
                unsafeResult.interactionData
            );

            // But handlerTypeDenominator should be the same
            expect(startResult.handlerTypeDenominator).toBe(
                completedResult.handlerTypeDenominator
            );
            expect(startResult.handlerTypeDenominator).toBe(
                unsafeResult.handlerTypeDenominator
            );

            // Verify they start with the correct interaction types
            expect(
                startResult.interactionData.startsWith(
                    interactionTypes.purchase.started
                )
            ).toBe(true);
            expect(
                completedResult.interactionData.startsWith(
                    interactionTypes.purchase.completed
                )
            ).toBe(true);
            expect(
                unsafeResult.interactionData.startsWith(
                    interactionTypes.purchase.unsafeCompleted
                )
            ).toBe(true);
        });

        it("should use the correct product type for purchase interactions", () => {
            const purchaseId = "0x123456789abcdef";
            // Create a properly padded proof element
            const proof: Hex[] = [pad("0xabc123", { size: 32 })];

            const startResult = PurchaseInteractionEncoder.startPurchase({
                purchaseId,
            });
            const completedResult =
                PurchaseInteractionEncoder.completedPurchase({
                    purchaseId,
                    proof,
                });
            const unsafeResult =
                PurchaseInteractionEncoder.unsafeCompletedPurchase({
                    purchaseId,
                });

            // Verify all use the same, correct product type
            const expected = toHex(productTypes.purchase);
            expect(startResult.handlerTypeDenominator).toBe(expected);
            expect(completedResult.handlerTypeDenominator).toBe(expected);
            expect(unsafeResult.handlerTypeDenominator).toBe(expected);
        });
    });
});
