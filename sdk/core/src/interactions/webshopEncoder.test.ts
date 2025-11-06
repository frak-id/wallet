/**
 * Tests for WebShopInteractionEncoder
 * Tests encoding of webshop-related user interactions
 */

import { toHex } from "viem";
import { describe, expect, it } from "../../tests/vitest-fixtures";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { WebShopInteractionEncoder } from "./webshopEncoder";

describe("WebShopInteractionEncoder", () => {
    describe("open", () => {
        it("should encode open webshop interaction with correct structure", () => {
            const interaction = WebShopInteractionEncoder.open();

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        it("should use webshop product type in handlerTypeDenominator", () => {
            const interaction = WebShopInteractionEncoder.open();

            // Should use webshop product type (3)
            const expectedDenominator = toHex(productTypes.webshop);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        it("should use open interaction type in data", () => {
            const interaction = WebShopInteractionEncoder.open();

            // Should use open interaction type
            expect(interaction.interactionData).toBe(
                interactionTypes.webshop.open
            );
        });

        it("should produce consistent output (no parameters)", () => {
            const interaction1 = WebShopInteractionEncoder.open();
            const interaction2 = WebShopInteractionEncoder.open();

            // Should always produce the same output
            expect(interaction1).toEqual(interaction2);
        });

        it("should produce valid hex string", () => {
            const interaction = WebShopInteractionEncoder.open();

            // Should be valid hex string starting with 0x
            expect(interaction.interactionData).toMatch(/^0x[0-9a-f]+$/);
        });
    });
});
