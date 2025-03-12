import { pad, toHex } from "viem";
import type { Address } from "viem";
/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { ReferralInteractionEncoder } from "./referralEncoder";

describe("ReferralInteractionEncoder", () => {
    describe("createLink", () => {
        it("should encode a create link interaction correctly", () => {
            // Get the prepared interaction
            const result = ReferralInteractionEncoder.createLink();

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.referral)
            );

            // Verify the interactionData is the correct interaction type
            expect(result.interactionData).toBe(
                interactionTypes.referral.createLink
            );
        });
    });

    describe("referred", () => {
        it("should encode a referred interaction correctly", () => {
            // Create a sample referrer address
            const referrer =
                "0x123456789abcdef123456789abcdef123456789a" as Address;

            // Get the prepared interaction
            const result = ReferralInteractionEncoder.referred({
                referrer,
            });

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.referral)
            );

            // Verify the interactionData starts with the correct interaction type
            expect(
                result.interactionData.startsWith(
                    interactionTypes.referral.referred
                )
            ).toBe(true);

            // Verify the interactionData includes the padded referrer address
            expect(
                result.interactionData.includes(
                    pad(referrer, { size: 32 }).slice(2)
                )
            ).toBe(true);
        });

        it("should pad short referrer addresses to 32 bytes", () => {
            // This is a bit contrived since Ethereum addresses are 20 bytes,
            // but we'll test the padding behavior anyway
            const shortReferrer = "0x123" as Address;

            // Get the prepared interaction
            const result = ReferralInteractionEncoder.referred({
                referrer: shortReferrer,
            });

            // Calculate the expected padded value
            const paddedReferrer = pad(shortReferrer, { size: 32 });

            // Verify that the padded address is present in the interaction data
            expect(
                result.interactionData.includes(paddedReferrer.slice(2))
            ).toBe(true);

            // Verify the total length of the interaction data is correct (8 chars for type + 64 chars for 32 bytes)
            expect(result.interactionData.length).toBe(2 + 8 + 64); // 2 for '0x', 8 for interaction type, 64 for padded address
        });

        it("should handle standard Ethereum addresses correctly", () => {
            // Standard Ethereum address (20 bytes / 40 hex chars after 0x)
            const standardAddress =
                "0x1234567890123456789012345678901234567890" as Address;

            // Get the prepared interaction
            const result = ReferralInteractionEncoder.referred({
                referrer: standardAddress,
            });

            // Verify the interaction data includes the padded address
            const paddedAddress = pad(standardAddress, { size: 32 });
            expect(
                result.interactionData.includes(paddedAddress.slice(2))
            ).toBe(true);
        });
    });

    describe("All methods", () => {
        it("should use the correct product type for referral interactions", () => {
            const referrer =
                "0x123456789abcdef123456789abcdef123456789a" as Address;

            const createLinkResult = ReferralInteractionEncoder.createLink();
            const referredResult = ReferralInteractionEncoder.referred({
                referrer,
            });

            // Verify both use the same, correct product type
            const expected = toHex(productTypes.referral);
            expect(createLinkResult.handlerTypeDenominator).toBe(expected);
            expect(referredResult.handlerTypeDenominator).toBe(expected);
        });

        it("should produce different interaction data for different methods", () => {
            const referrer =
                "0x123456789abcdef123456789abcdef123456789a" as Address;

            const createLinkResult = ReferralInteractionEncoder.createLink();
            const referredResult = ReferralInteractionEncoder.referred({
                referrer,
            });

            // Verify interaction data is different
            expect(createLinkResult.interactionData).not.toBe(
                referredResult.interactionData
            );

            // Verify they have the correct interaction types
            expect(createLinkResult.interactionData).toBe(
                interactionTypes.referral.createLink
            );
            expect(
                referredResult.interactionData.startsWith(
                    interactionTypes.referral.referred
                )
            ).toBe(true);
        });
    });
});
