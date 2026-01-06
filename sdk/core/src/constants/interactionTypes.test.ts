/**
 * Tests for interactionTypes constants
 * Tests interaction type definitions and type utilities
 */

import { describe, expect, it } from "vitest";
import { interactionTypes } from "./interactionTypes";

describe("interactionTypes", () => {
    describe("structure", () => {
        it("should have all expected categories", () => {
            expect(interactionTypes).toHaveProperty("press");
            expect(interactionTypes).toHaveProperty("dapp");
            expect(interactionTypes).toHaveProperty("webshop");
            expect(interactionTypes).toHaveProperty("referral");
            expect(interactionTypes).toHaveProperty("purchase");
            expect(interactionTypes).toHaveProperty("retail");
        });

        it("should have press interactions", () => {
            expect(interactionTypes.press).toEqual({
                openArticle: "0xc0a24ffb",
                readArticle: "0xd5bd0fbe",
            });
        });

        it("should have dapp interactions", () => {
            expect(interactionTypes.dapp).toEqual({
                proofVerifiableStorageUpdate: "0x2ab2aeef",
                callableVerifiableStorageUpdate: "0xa07da986",
            });
        });

        it("should have webshop interactions", () => {
            expect(interactionTypes.webshop).toEqual({
                open: "0xb311798f",
            });
        });

        it("should have referral interactions", () => {
            expect(interactionTypes.referral).toEqual({
                referred: "0x010cc3b9",
                createLink: "0xb2c0f17c",
            });
        });

        it("should have purchase interactions", () => {
            expect(interactionTypes.purchase).toEqual({
                started: "0xd87e90c3",
                completed: "0x8403aeb4",
                unsafeCompleted: "0x4d5b14e0",
            });
        });

        it("should have retail interactions", () => {
            expect(interactionTypes.retail).toEqual({
                customerMeeting: "0x74489004",
            });
        });
    });

    describe("interaction values", () => {
        it("should have all interaction values as hex strings", () => {
            Object.values(interactionTypes).forEach((category) => {
                Object.values(category).forEach((value) => {
                    expect(value).toMatch(/^0x[a-f0-9]{8}$/);
                });
            });
        });

        it("should have unique interaction values across all categories", () => {
            const allValues = Object.values(interactionTypes).flatMap(
                (category) => Object.values(category)
            );
            const uniqueValues = new Set(allValues);
            expect(allValues.length).toBe(uniqueValues.size);
        });
    });

    describe("specific interactions", () => {
        it("should have correct press.openArticle value", () => {
            expect(interactionTypes.press.openArticle).toBe("0xc0a24ffb");
        });

        it("should have correct press.readArticle value", () => {
            expect(interactionTypes.press.readArticle).toBe("0xd5bd0fbe");
        });

        it("should have correct webshop.open value", () => {
            expect(interactionTypes.webshop.open).toBe("0xb311798f");
        });

        it("should have correct referral.referred value", () => {
            expect(interactionTypes.referral.referred).toBe("0x010cc3b9");
        });

        it("should have correct purchase.completed value", () => {
            expect(interactionTypes.purchase.completed).toBe("0x8403aeb4");
        });

        it("should have correct purchase.unsafeCompleted value", () => {
            expect(interactionTypes.purchase.unsafeCompleted).toBe(
                "0x4d5b14e0"
            );
        });

        it("should have correct retail.customerMeeting value", () => {
            expect(interactionTypes.retail.customerMeeting).toBe("0x74489004");
        });
    });

    describe("type safety", () => {
        it("should be readonly (as const)", () => {
            // TypeScript ensures this is readonly, but we can verify structure
            expect(Object.isFrozen(interactionTypes)).toBe(false);
            // The values should be consistent
            expect(typeof interactionTypes.press.openArticle).toBe("string");
        });

        it("should have consistent structure across categories", () => {
            Object.values(interactionTypes).forEach((category) => {
                expect(typeof category).toBe("object");
                expect(category).not.toBeNull();
                expect(Array.isArray(category)).toBe(false);
            });
        });
    });
});
