/**
 * Tests for ReferralInteractionEncoder
 * Tests encoding of referral-related user interactions
 */

import { pad, toHex } from "viem";
import { describe, expect, it, test } from "../../tests/vitest-fixtures";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { ReferralInteractionEncoder } from "./referralEncoder";

describe("ReferralInteractionEncoder", () => {
    describe("createLink", () => {
        it("should encode create link interaction with correct structure", () => {
            const interaction = ReferralInteractionEncoder.createLink();

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        it("should use referral product type in handlerTypeDenominator", () => {
            const interaction = ReferralInteractionEncoder.createLink();

            // Should use referral product type (30)
            const expectedDenominator = toHex(productTypes.referral);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        it("should use createLink interaction type in data", () => {
            const interaction = ReferralInteractionEncoder.createLink();

            // Should use createLink interaction type
            expect(interaction.interactionData).toBe(
                interactionTypes.referral.createLink
            );
        });

        it("should produce consistent output (no parameters)", () => {
            const interaction1 = ReferralInteractionEncoder.createLink();
            const interaction2 = ReferralInteractionEncoder.createLink();

            // Should always produce the same output
            expect(interaction1).toEqual(interaction2);
        });
    });

    describe("referred", () => {
        test("should encode referred interaction with correct structure", ({
            mockReferrerAddress,
        }) => {
            const interaction = ReferralInteractionEncoder.referred({
                referrer: mockReferrerAddress,
            });

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        test("should use referral product type in handlerTypeDenominator", ({
            mockReferrerAddress,
        }) => {
            const interaction = ReferralInteractionEncoder.referred({
                referrer: mockReferrerAddress,
            });

            // Should use referral product type (30)
            const expectedDenominator = toHex(productTypes.referral);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        test("should include referred interaction type in data", ({
            mockReferrerAddress,
        }) => {
            const interaction = ReferralInteractionEncoder.referred({
                referrer: mockReferrerAddress,
            });

            // Should start with referred interaction type
            expect(interaction.interactionData).toContain(
                interactionTypes.referral.referred
            );
        });

        test("should pad referrer address to 32 bytes", ({
            mockReferrerAddress,
        }) => {
            const interaction = ReferralInteractionEncoder.referred({
                referrer: mockReferrerAddress,
            });

            // Referrer address should be padded to 32 bytes
            const paddedAddress = pad(mockReferrerAddress, { size: 32 });
            expect(interaction.interactionData).toContain(
                paddedAddress.slice(2)
            );
        });

        test("should produce different output for different referrers", () => {
            const referrer1 =
                "0x1234567890123456789012345678901234567890" as const;
            const referrer2 =
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;

            const interaction1 = ReferralInteractionEncoder.referred({
                referrer: referrer1,
            });
            const interaction2 = ReferralInteractionEncoder.referred({
                referrer: referrer2,
            });

            // Different referrers should produce different interaction data
            expect(interaction1.interactionData).not.toBe(
                interaction2.interactionData
            );
        });

        test("should produce consistent output for same referrer", ({
            mockReferrerAddress,
        }) => {
            const interaction1 = ReferralInteractionEncoder.referred({
                referrer: mockReferrerAddress,
            });
            const interaction2 = ReferralInteractionEncoder.referred({
                referrer: mockReferrerAddress,
            });

            // Same referrer should produce same output
            expect(interaction1).toEqual(interaction2);
        });
    });

    describe("interaction data format", () => {
        test("should produce valid hex strings", ({ mockReferrerAddress }) => {
            const createLinkInteraction =
                ReferralInteractionEncoder.createLink();
            const referredInteraction = ReferralInteractionEncoder.referred({
                referrer: mockReferrerAddress,
            });

            // Both should be valid hex strings starting with 0x
            expect(createLinkInteraction.interactionData).toMatch(
                /^0x[0-9a-f]+$/
            );
            expect(referredInteraction.interactionData).toMatch(
                /^0x[0-9a-f]+$/
            );
        });

        test("should have different interaction types", ({
            mockReferrerAddress,
        }) => {
            const createLinkInteraction =
                ReferralInteractionEncoder.createLink();
            const referredInteraction = ReferralInteractionEncoder.referred({
                referrer: mockReferrerAddress,
            });

            // Different interaction types should produce different data
            expect(createLinkInteraction.interactionData).not.toBe(
                referredInteraction.interactionData
            );
        });
    });
});
