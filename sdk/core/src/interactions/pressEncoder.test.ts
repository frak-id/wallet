/**
 * Tests for PressInteractionEncoder
 * Tests encoding of press-related user interactions
 */

import { pad, toHex } from "viem";
import { describe, expect, it, test } from "../../tests/vitest-fixtures";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { PressInteractionEncoder } from "./pressEncoder";

describe("PressInteractionEncoder", () => {
    describe("openArticle", () => {
        test("should encode open article interaction with correct structure", ({
            mockArticleId,
        }) => {
            const interaction = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        test("should use press product type in handlerTypeDenominator", ({
            mockArticleId,
        }) => {
            const interaction = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });

            // Should use press product type (2)
            const expectedDenominator = toHex(productTypes.press);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        test("should include openArticle interaction type in data", ({
            mockArticleId,
        }) => {
            const interaction = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });

            // Should start with openArticle interaction type
            expect(interaction.interactionData).toContain(
                interactionTypes.press.openArticle
            );
        });

        test("should pad article ID to 32 bytes", ({ mockArticleId }) => {
            const interaction = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });

            // Article ID should be padded to 32 bytes (64 hex chars + 0x prefix = 66 chars)
            const paddedArticleId = pad(mockArticleId, { size: 32 });
            expect(interaction.interactionData).toContain(
                paddedArticleId.slice(2)
            );
        });

        it("should handle short article IDs by padding", () => {
            const shortArticleId = "0x01" as const;
            const interaction = PressInteractionEncoder.openArticle({
                articleId: shortArticleId,
            });

            // Should pad short IDs to 32 bytes
            expect(interaction.interactionData).toBeDefined();
            // Total length: openArticle (10 chars) + padded ID (64 chars) + 0x (2 chars) = 76 chars
            expect(interaction.interactionData.length).toBeGreaterThan(64);
        });

        test("should produce consistent output for same article ID", ({
            mockArticleId,
        }) => {
            const interaction1 = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });
            const interaction2 = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });

            // Same input should produce same output
            expect(interaction1).toEqual(interaction2);
        });
    });

    describe("readArticle", () => {
        test("should encode read article interaction with correct structure", ({
            mockArticleId,
        }) => {
            const interaction = PressInteractionEncoder.readArticle({
                articleId: mockArticleId,
            });

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        test("should use press product type in handlerTypeDenominator", ({
            mockArticleId,
        }) => {
            const interaction = PressInteractionEncoder.readArticle({
                articleId: mockArticleId,
            });

            // Should use press product type (2)
            const expectedDenominator = toHex(productTypes.press);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        test("should include readArticle interaction type in data", ({
            mockArticleId,
        }) => {
            const interaction = PressInteractionEncoder.readArticle({
                articleId: mockArticleId,
            });

            // Should start with readArticle interaction type
            expect(interaction.interactionData).toContain(
                interactionTypes.press.readArticle
            );
        });

        test("should pad article ID to 32 bytes", ({ mockArticleId }) => {
            const interaction = PressInteractionEncoder.readArticle({
                articleId: mockArticleId,
            });

            // Article ID should be padded to 32 bytes
            const paddedArticleId = pad(mockArticleId, { size: 32 });
            expect(interaction.interactionData).toContain(
                paddedArticleId.slice(2)
            );
        });

        test("should produce different output than openArticle for same ID", ({
            mockArticleId,
        }) => {
            const openInteraction = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });
            const readInteraction = PressInteractionEncoder.readArticle({
                articleId: mockArticleId,
            });

            // Different interaction types should produce different data
            expect(openInteraction.interactionData).not.toBe(
                readInteraction.interactionData
            );

            // But should have same handlerTypeDenominator (both press)
            expect(openInteraction.handlerTypeDenominator).toBe(
                readInteraction.handlerTypeDenominator
            );
        });
    });

    describe("interaction data format", () => {
        test("should concatenate interaction type and padded article ID", ({
            mockArticleId,
        }) => {
            const interaction = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });

            // Should start with interaction type (10 chars including 0x)
            expect(interaction.interactionData.slice(0, 10)).toBe(
                interactionTypes.press.openArticle
            );

            // Should be followed by padded article ID (64 hex chars)
            expect(interaction.interactionData.length).toBe(74); // 0x + 8 (type) + 64 (padded ID)
        });

        test("should produce valid hex strings", ({ mockArticleId }) => {
            const openInteraction = PressInteractionEncoder.openArticle({
                articleId: mockArticleId,
            });
            const readInteraction = PressInteractionEncoder.readArticle({
                articleId: mockArticleId,
            });

            // Both should be valid hex strings starting with 0x
            expect(openInteraction.interactionData).toMatch(/^0x[0-9a-f]+$/);
            expect(readInteraction.interactionData).toMatch(/^0x[0-9a-f]+$/);
        });

        it("should handle different article IDs correctly", () => {
            const articleId1 =
                "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
            const articleId2 =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as const;

            const interaction1 = PressInteractionEncoder.openArticle({
                articleId: articleId1,
            });
            const interaction2 = PressInteractionEncoder.openArticle({
                articleId: articleId2,
            });

            // Different article IDs should produce different interaction data
            expect(interaction1.interactionData).not.toBe(
                interaction2.interactionData
            );
        });
    });
});
