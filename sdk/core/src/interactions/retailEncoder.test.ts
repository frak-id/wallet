import { pad, toHex } from "viem";
import type { Hex } from "viem";
/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import { RetailInteractionEncoder } from "./retailEncoder";

describe("RetailInteractionEncoder", () => {
    describe("customerMeeting", () => {
        it("should encode a customer meeting interaction correctly", () => {
            // Create a sample agency ID
            const agencyId = "0x123456789abcdef" as Hex;

            // Get the prepared interaction
            const result = RetailInteractionEncoder.customerMeeting({
                agencyId,
            });

            // Verify the structure of the result
            expect(result).toHaveProperty("handlerTypeDenominator");
            expect(result).toHaveProperty("interactionData");

            // Verify the handlerTypeDenominator is correct
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.retail)
            );

            // Verify the interactionData starts with the correct interaction type
            expect(
                result.interactionData.startsWith(
                    interactionTypes.retail.customerMeeting
                )
            ).toBe(true);

            // Verify the interactionData includes the padded agencyId
            expect(
                result.interactionData.includes(
                    pad(agencyId, { size: 32 }).slice(2)
                )
            ).toBe(true);
        });

        it("should pad short agency IDs to 32 bytes", () => {
            // Create a very short agency ID
            const shortAgencyId = "0x1" as Hex;

            // Get the prepared interaction
            const result = RetailInteractionEncoder.customerMeeting({
                agencyId: shortAgencyId,
            });

            // Calculate the expected padded value
            const paddedAgencyId = pad(shortAgencyId, { size: 32 });

            // Verify that the padded ID is present in the interaction data
            expect(
                result.interactionData.includes(paddedAgencyId.slice(2))
            ).toBe(true);

            // Verify the total length of the interaction data is correct (8 chars for type + 64 chars for 32 bytes)
            expect(result.interactionData.length).toBe(2 + 8 + 64); // 2 for '0x', 8 for interaction type, 64 for padded ID
        });

        it("should handle already 32-byte agency IDs correctly", () => {
            // Create a full-length 32-byte agency ID (64 hex chars after 0x)
            const fullAgencyId = `0x${"a".repeat(64)}` as Hex;

            // Get the prepared interaction
            const result = RetailInteractionEncoder.customerMeeting({
                agencyId: fullAgencyId,
            });

            // Verify the interaction data includes the full agency ID without extra padding
            expect(result.interactionData.includes(fullAgencyId.slice(2))).toBe(
                true
            );
        });

        it("should use the correct product type for retail interactions", () => {
            const agencyId = "0x123456789abcdef" as Hex;

            const result = RetailInteractionEncoder.customerMeeting({
                agencyId,
            });

            // Verify the correct product type is used
            expect(result.handlerTypeDenominator).toBe(
                toHex(productTypes.retail)
            );
        });
    });
});
