/**
 * Tests for RetailInteractionEncoder
 * Tests encoding of retail-related user interactions
 */

import { pad, toHex } from "viem";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { RetailInteractionEncoder } from "./retailEncoder";

describe("RetailInteractionEncoder", () => {
    describe("customerMeeting", () => {
        test("should encode customer meeting interaction with correct structure", ({
            mockAgencyId,
        }) => {
            const interaction = RetailInteractionEncoder.customerMeeting({
                agencyId: mockAgencyId,
            });

            // Should return PreparedInteraction structure
            expect(interaction).toHaveProperty("handlerTypeDenominator");
            expect(interaction).toHaveProperty("interactionData");
        });

        test("should use retail product type in handlerTypeDenominator", ({
            mockAgencyId,
        }) => {
            const interaction = RetailInteractionEncoder.customerMeeting({
                agencyId: mockAgencyId,
            });

            // Should use retail product type (4)
            const expectedDenominator = toHex(productTypes.retail);
            expect(interaction.handlerTypeDenominator).toBe(
                expectedDenominator
            );
        });

        test("should include customerMeeting interaction type in data", ({
            mockAgencyId,
        }) => {
            const interaction = RetailInteractionEncoder.customerMeeting({
                agencyId: mockAgencyId,
            });

            // Should start with customerMeeting interaction type
            expect(interaction.interactionData).toContain(
                interactionTypes.retail.customerMeeting
            );
        });

        test("should pad agency ID to 32 bytes", ({ mockAgencyId }) => {
            const interaction = RetailInteractionEncoder.customerMeeting({
                agencyId: mockAgencyId,
            });

            // Agency ID should be padded to 32 bytes
            const paddedAgencyId = pad(mockAgencyId, { size: 32 });
            expect(interaction.interactionData).toContain(
                paddedAgencyId.slice(2)
            );
        });

        test("should produce consistent output for same agency ID", ({
            mockAgencyId,
        }) => {
            const interaction1 = RetailInteractionEncoder.customerMeeting({
                agencyId: mockAgencyId,
            });
            const interaction2 = RetailInteractionEncoder.customerMeeting({
                agencyId: mockAgencyId,
            });

            // Same input should produce same output
            expect(interaction1).toEqual(interaction2);
        });

        test("should produce different output for different agency IDs", () => {
            const agencyId1 =
                "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
            const agencyId2 =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as const;

            const interaction1 = RetailInteractionEncoder.customerMeeting({
                agencyId: agencyId1,
            });
            const interaction2 = RetailInteractionEncoder.customerMeeting({
                agencyId: agencyId2,
            });

            // Different agency IDs should produce different interaction data
            expect(interaction1.interactionData).not.toBe(
                interaction2.interactionData
            );
        });

        test("should produce valid hex string", ({ mockAgencyId }) => {
            const interaction = RetailInteractionEncoder.customerMeeting({
                agencyId: mockAgencyId,
            });

            // Should be valid hex string starting with 0x
            expect(interaction.interactionData).toMatch(/^0x[0-9a-f]+$/);
        });
    });
});
