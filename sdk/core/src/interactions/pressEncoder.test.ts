import { pad, toHex } from "viem";
/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { PressInteractionEncoder } from "./pressEncoder";

describe("PressInteractionEncoder", () => {
    describe("openArticle", () => {
        it("should encode an open article interaction correctly", () => {
            // Create a sample article ID
            const articleId = "0x123456789abcdef";

            // Get the prepared interaction
            const result = PressInteractionEncoder.openArticle({ articleId });

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.press)
            );

            // Verify the interactionData starts with the correct interaction type
            expect(
                result.interactionData.startsWith(
                    interactionTypes.press.openArticle
                )
            ).toBe(true);

            // Verify the interactionData includes the padded articleId
            expect(
                result.interactionData.includes(
                    pad(articleId, { size: 32 }).slice(2)
                )
            ).toBe(true);
        });

        it("should pad short article IDs to 32 bytes", () => {
            // Create a very short article ID
            const shortArticleId = "0x1";

            // Get the prepared interaction
            const result = PressInteractionEncoder.openArticle({
                articleId: shortArticleId,
            });

            // Calculate the expected padded value
            const paddedArticleId = pad(shortArticleId, { size: 32 });

            // Verify that the padded ID is present in the interaction data
            expect(
                result.interactionData.includes(paddedArticleId.slice(2))
            ).toBe(true);

            // Verify the total length of the interaction data is correct (8 chars for type + 64 chars for 32 bytes)
            expect(result.interactionData.length).toBe(2 + 8 + 64); // 2 for '0x', 8 for interaction type, 64 for padded ID
        });

        it("should handle already 32-byte article IDs correctly", () => {
            // Create a full-length 32-byte article ID (64 hex chars after 0x)
            const fullArticleId = `0x${"a".repeat(64)}` as const;

            // Get the prepared interaction
            const result = PressInteractionEncoder.openArticle({
                articleId: fullArticleId,
            });

            // Verify the interaction data includes the full article ID without extra padding
            expect(
                result.interactionData.includes(fullArticleId.slice(2))
            ).toBe(true);
        });
    });

    describe("readArticle", () => {
        it("should encode a read article interaction correctly", () => {
            // Create a sample article ID
            const articleId = "0x123456789abcdef";

            // Get the prepared interaction
            const result = PressInteractionEncoder.readArticle({ articleId });

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.press)
            );

            // Verify the interactionData starts with the correct interaction type
            expect(
                result.interactionData.startsWith(
                    interactionTypes.press.readArticle
                )
            ).toBe(true);

            // Verify the interactionData includes the padded articleId
            expect(
                result.interactionData.includes(
                    pad(articleId, { size: 32 }).slice(2)
                )
            ).toBe(true);
        });

        it("should pad short article IDs to 32 bytes", () => {
            // Create a very short article ID
            const shortArticleId = "0x1";

            // Get the prepared interaction
            const result = PressInteractionEncoder.readArticle({
                articleId: shortArticleId,
            });

            // Calculate the expected padded value
            const paddedArticleId = pad(shortArticleId, { size: 32 });

            // Verify that the padded ID is present in the interaction data
            expect(
                result.interactionData.includes(paddedArticleId.slice(2))
            ).toBe(true);

            // Verify the total length of the interaction data is correct (8 chars for type + 64 chars for 32 bytes)
            expect(result.interactionData.length).toBe(2 + 8 + 64); // 2 for '0x', 8 for interaction type, 64 for padded ID
        });

        it("should handle already 32-byte article IDs correctly", () => {
            // Create a full-length 32-byte article ID (64 hex chars after 0x)
            const fullArticleId = `0x${"a".repeat(64)}` as const;

            // Get the prepared interaction
            const result = PressInteractionEncoder.readArticle({
                articleId: fullArticleId,
            });

            // Verify the interaction data includes the full article ID without extra padding
            expect(
                result.interactionData.includes(fullArticleId.slice(2))
            ).toBe(true);
        });
    });

    describe("Both encoders", () => {
        it("should produce different interaction data for the same article ID", () => {
            const articleId = "0x123456789abcdef";

            const openResult = PressInteractionEncoder.openArticle({
                articleId,
            });
            const readResult = PressInteractionEncoder.readArticle({
                articleId,
            });

            // Verify the interaction data is different
            expect(openResult.interactionData).not.toBe(
                readResult.interactionData
            );

            // But handlerTypeDenominator should be the same
            expect(openResult.handlerTypeDenominator).toBe(
                readResult.handlerTypeDenominator
            );

            // Verify they start with the correct interaction types
            expect(
                openResult.interactionData.startsWith(
                    interactionTypes.press.openArticle
                )
            ).toBe(true);
            expect(
                readResult.interactionData.startsWith(
                    interactionTypes.press.readArticle
                )
            ).toBe(true);
        });

        it("should use the correct product type for press interactions", () => {
            const articleId = "0x123456789abcdef";

            const openResult = PressInteractionEncoder.openArticle({
                articleId,
            });
            const readResult = PressInteractionEncoder.readArticle({
                articleId,
            });

            // Verify both use the same, correct product type
            expect(openResult.handlerTypeDenominator).toBe(
                toHex(productTypes.press)
            );
            expect(readResult.handlerTypeDenominator).toBe(
                toHex(productTypes.press)
            );
        });
    });
});
