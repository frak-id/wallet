import { describe, expect, it } from "vitest";
import {
    affiliationFixedCampaignConfigStruct,
    affiliationFixedCampaignId,
    affiliationRangeCampaignConfigStruct,
    affiliationRangeCampaignId,
} from "./constants";

describe("campaign constants", () => {
    describe("campaign IDs", () => {
        it("should have valid affiliation range campaign ID", () => {
            expect(affiliationRangeCampaignId).toBe("0xf1a57c61");
            expect(typeof affiliationRangeCampaignId).toBe("string");
            expect(affiliationRangeCampaignId.startsWith("0x")).toBe(true);
        });

        it("should have valid affiliation fixed campaign ID", () => {
            expect(affiliationFixedCampaignId).toBe("0x26def63c");
            expect(typeof affiliationFixedCampaignId).toBe("string");
            expect(affiliationFixedCampaignId.startsWith("0x")).toBe(true);
        });

        it("should have different campaign IDs", () => {
            expect(affiliationRangeCampaignId).not.toBe(
                affiliationFixedCampaignId
            );
        });
    });

    describe("affiliationRangeCampaignConfigStruct", () => {
        it("should be an array", () => {
            expect(Array.isArray(affiliationRangeCampaignConfigStruct)).toBe(
                true
            );
        });

        it("should have correct structure fields", () => {
            const fieldNames = affiliationRangeCampaignConfigStruct.map(
                (field) => field.name
            );
            expect(fieldNames).toContain("name");
            expect(fieldNames).toContain("campaignBank");
            expect(fieldNames).toContain("capConfig");
            expect(fieldNames).toContain("activationPeriod");
            expect(fieldNames).toContain("chainingConfig");
            expect(fieldNames).toContain("triggers");
        });

        it("should have correct types for each field", () => {
            for (const field of affiliationRangeCampaignConfigStruct) {
                expect(field).toHaveProperty("name");
                expect(field).toHaveProperty("internalType");
                expect(field).toHaveProperty("type");
            }
        });

        it("should have tuple structures with components", () => {
            const tuplesWithComponents =
                affiliationRangeCampaignConfigStruct.filter(
                    (field) =>
                        field.type === "tuple" || field.type === "tuple[]"
                );

            for (const tuple of tuplesWithComponents) {
                expect(tuple).toHaveProperty("components");
                expect(Array.isArray((tuple as any).components)).toBe(true);
            }
        });
    });

    describe("affiliationFixedCampaignConfigStruct", () => {
        it("should be an array", () => {
            expect(Array.isArray(affiliationFixedCampaignConfigStruct)).toBe(
                true
            );
        });

        it("should have correct structure fields", () => {
            const fieldNames = affiliationFixedCampaignConfigStruct.map(
                (field) => field.name
            );
            expect(fieldNames).toContain("name");
            expect(fieldNames).toContain("campaignBank");
            expect(fieldNames).toContain("capConfig");
            expect(fieldNames).toContain("activationPeriod");
            expect(fieldNames).toContain("chainingConfig");
            expect(fieldNames).toContain("triggers");
        });

        it("should have correct types for each field", () => {
            for (const field of affiliationFixedCampaignConfigStruct) {
                expect(field).toHaveProperty("name");
                expect(field).toHaveProperty("internalType");
                expect(field).toHaveProperty("type");
            }
        });

        it("should have tuple structures with components", () => {
            const tuplesWithComponents =
                affiliationFixedCampaignConfigStruct.filter(
                    (field) =>
                        field.type === "tuple" || field.type === "tuple[]"
                );

            for (const tuple of tuplesWithComponents) {
                expect(tuple).toHaveProperty("components");
                expect(Array.isArray((tuple as any).components)).toBe(true);
            }
        });
    });

    describe("struct comparison", () => {
        it("should have similar base structure between range and fixed", () => {
            const rangeFields = affiliationRangeCampaignConfigStruct.map(
                (f) => f.name
            );
            const fixedFields = affiliationFixedCampaignConfigStruct.map(
                (f) => f.name
            );

            // Both should have common fields
            expect(rangeFields).toContain("name");
            expect(rangeFields).toContain("campaignBank");
            expect(fixedFields).toContain("name");
            expect(fixedFields).toContain("campaignBank");
        });

        it("should have same number of top-level fields", () => {
            expect(affiliationRangeCampaignConfigStruct.length).toBe(6);
            expect(affiliationFixedCampaignConfigStruct.length).toBe(6);
        });
    });
});
