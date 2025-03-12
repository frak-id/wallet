import { toHex } from "viem";
/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { WebShopInteractionEncoder } from "./webshopEncoder";

describe("WebShopInteractionEncoder", () => {
    describe("open", () => {
        it("should encode an open webshop interaction correctly", () => {
            // Get the prepared interaction
            const result = WebShopInteractionEncoder.open();

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.webshop)
            );

            // Verify the interactionData is the correct interaction type
            expect(result.interactionData).toBe(interactionTypes.webshop.open);
        });

        it("should use the correct product type for webshop interactions", () => {
            const result = WebShopInteractionEncoder.open();

            // Verify the correct product type is used
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.webshop)
            );
        });
    });
});
