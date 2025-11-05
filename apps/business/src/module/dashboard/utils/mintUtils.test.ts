import { describe, expect, it } from "vitest";
import {
    defaultProductTypes,
    getDefaultStablecoin,
    productTypeDescriptions,
} from "./mintUtils";

describe("mintUtils", () => {
    describe("getDefaultStablecoin", () => {
        it("should return eure for European languages", () => {
            // Mock navigator.language
            Object.defineProperty(navigator, "language", {
                value: "fr-FR",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("eure");
        });

        it("should return usde for US English", () => {
            Object.defineProperty(navigator, "language", {
                value: "en-US",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("usde");
        });

        it("should return gbpe for British English", () => {
            Object.defineProperty(navigator, "language", {
                value: "en-GB",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("gbpe");
        });

        it("should return eure for other languages", () => {
            Object.defineProperty(navigator, "language", {
                value: "de-DE",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("eure");
        });

        it("should handle case-insensitive language codes", () => {
            Object.defineProperty(navigator, "language", {
                value: "EN-US",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("usde");
        });

        it("should return eure when navigator is undefined", () => {
            // Save original navigator
            const originalNavigator = global.navigator;

            // @ts-expect-error - testing undefined navigator
            delete global.navigator;

            const result = getDefaultStablecoin();
            expect(result).toBe("eure");

            // Restore navigator
            global.navigator = originalNavigator;
        });
    });

    describe("defaultProductTypes", () => {
        it("should be an array", () => {
            expect(Array.isArray(defaultProductTypes)).toBe(true);
        });

        it("should have 3 default types", () => {
            expect(defaultProductTypes).toHaveLength(3);
        });

        it("should include referral, purchase, and webshop", () => {
            expect(defaultProductTypes).toContain("referral");
            expect(defaultProductTypes).toContain("purchase");
            expect(defaultProductTypes).toContain("webshop");
        });

        it("should not include press or dapp by default", () => {
            expect(defaultProductTypes).not.toContain("press");
            expect(defaultProductTypes).not.toContain("dapp");
        });
    });

    describe("productTypeDescriptions", () => {
        it("should have descriptions for all 6 product types", () => {
            expect(productTypeDescriptions.referral).toBeDefined();
            expect(productTypeDescriptions.purchase).toBeDefined();
            expect(productTypeDescriptions.webshop).toBeDefined();
            expect(productTypeDescriptions.retail).toBeDefined();
            expect(productTypeDescriptions.press).toBeDefined();
            expect(productTypeDescriptions.dapp).toBeDefined();
        });

        it("should have all required fields for each type", () => {
            for (const [_key, desc] of Object.entries(
                productTypeDescriptions
            )) {
                expect(desc.name).toBeTruthy();
                expect(desc.description).toBeTruthy();
                expect(desc.useCase).toBeTruthy();
                expect(Array.isArray(desc.events)).toBe(true);
                expect(desc.events.length).toBeGreaterThan(0);
            }
        });

        it("should have unique names", () => {
            const names = Object.values(productTypeDescriptions).map(
                (desc) => desc.name
            );
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(names.length);
        });

        it("should have non-empty events arrays", () => {
            for (const desc of Object.values(productTypeDescriptions)) {
                expect(desc.events.length).toBeGreaterThan(0);
            }
        });

        it("should have detailed descriptions", () => {
            for (const desc of Object.values(productTypeDescriptions)) {
                expect(desc.description.length).toBeGreaterThan(20);
                expect(desc.useCase.length).toBeGreaterThan(20);
            }
        });

        it("should have specific events for referral", () => {
            expect(productTypeDescriptions.referral.events).toContain(
                "Referred"
            );
            expect(productTypeDescriptions.referral.events).toContain(
                "Create Link"
            );
        });

        it("should have specific events for purchase", () => {
            expect(productTypeDescriptions.purchase.events).toContain(
                "Purchase Started"
            );
            expect(productTypeDescriptions.purchase.events).toContain(
                "Purchase Completed"
            );
        });

        it("should have specific events for webshop", () => {
            expect(productTypeDescriptions.webshop.events).toContain("Visit");
        });

        it("should have specific events for press", () => {
            expect(productTypeDescriptions.press.events).toContain(
                "Open Article"
            );
            expect(productTypeDescriptions.press.events).toContain(
                "Read Article"
            );
        });

        it("should have specific events for retail", () => {
            expect(productTypeDescriptions.retail.events).toContain(
                "Customer Meetup"
            );
        });

        it("should have specific events for dapp", () => {
            expect(productTypeDescriptions.dapp.events).toContain(
                "Onchain Storage Update"
            );
            expect(productTypeDescriptions.dapp.events).toContain(
                "Onchain Proof Verification"
            );
        });
    });
});
