import { describe, expect, it } from "vitest";
import { currencyOptions } from "./currencyOptions";

describe("currencyOptions", () => {
    describe("structure", () => {
        it("should have exactly 2 groups", () => {
            expect(currencyOptions).toHaveLength(2);
        });

        it("should have Monerium group", () => {
            const moneriumGroup = currencyOptions.find(
                (group) => group.group === "Monerium"
            );
            expect(moneriumGroup).toBeDefined();
            expect(moneriumGroup?.description).toBe(
                "Best for easy IBAN transfer for end users"
            );
        });

        it("should have Circle group", () => {
            const circleGroup = currencyOptions.find(
                (group) => group.group === "Circle"
            );
            expect(circleGroup).toBeDefined();
            expect(circleGroup?.description).toBe(
                "Best for blockchain usage for end users"
            );
        });
    });

    describe("Monerium options", () => {
        it("should have EURe, GBPe, and USDe", () => {
            const moneriumGroup = currencyOptions.find(
                (group) => group.group === "Monerium"
            );

            expect(moneriumGroup?.options).toHaveLength(3);

            const values = moneriumGroup?.options.map((opt) => opt.value);
            expect(values).toContain("eure");
            expect(values).toContain("gbpe");
            expect(values).toContain("usde");
        });

        it("should have correct labels for Monerium currencies", () => {
            const moneriumGroup = currencyOptions.find(
                (group) => group.group === "Monerium"
            );

            const eureOption = moneriumGroup?.options.find(
                (opt) => opt.value === "eure"
            );
            expect(eureOption?.label).toBe("EURe");

            const gbpeOption = moneriumGroup?.options.find(
                (opt) => opt.value === "gbpe"
            );
            expect(gbpeOption?.label).toBe("GBPe");

            const usdeOption = moneriumGroup?.options.find(
                (opt) => opt.value === "usde"
            );
            expect(usdeOption?.label).toBe("USDe");
        });
    });

    describe("Circle options", () => {
        it("should have USDC", () => {
            const circleGroup = currencyOptions.find(
                (group) => group.group === "Circle"
            );

            expect(circleGroup?.options).toHaveLength(1);

            const values = circleGroup?.options.map((opt) => opt.value);
            expect(values).toContain("usdc");
        });

        it("should have correct label for USDC", () => {
            const circleGroup = currencyOptions.find(
                (group) => group.group === "Circle"
            );

            const usdcOption = circleGroup?.options.find(
                (opt) => opt.value === "usdc"
            );
            expect(usdcOption?.label).toBe("USDC");
        });
    });

    describe("data integrity", () => {
        it("should have all required fields for each group", () => {
            for (const group of currencyOptions) {
                expect(group.group).toBeTruthy();
                expect(group.description).toBeTruthy();
                expect(Array.isArray(group.options)).toBe(true);
                expect(group.options.length).toBeGreaterThan(0);
            }
        });

        it("should have all required fields for each option", () => {
            for (const group of currencyOptions) {
                for (const option of group.options) {
                    expect(option.value).toBeTruthy();
                    expect(option.label).toBeTruthy();
                    expect(typeof option.value).toBe("string");
                    expect(typeof option.label).toBe("string");
                }
            }
        });

        it("should have unique values across all options", () => {
            const allValues = currencyOptions.flatMap((group) =>
                group.options.map((opt) => opt.value)
            );
            const uniqueValues = new Set(allValues);
            expect(uniqueValues.size).toBe(allValues.length);
        });

        it("should have lowercase values", () => {
            for (const group of currencyOptions) {
                for (const option of group.options) {
                    expect(option.value).toBe(option.value.toLowerCase());
                }
            }
        });

        it("should have at least 4 total currency options", () => {
            const totalOptions = currencyOptions.reduce(
                (sum, group) => sum + group.options.length,
                0
            );
            expect(totalOptions).toBeGreaterThanOrEqual(4);
        });
    });

    describe("group descriptions", () => {
        it("should have descriptive text for each group", () => {
            for (const group of currencyOptions) {
                expect(group.description.length).toBeGreaterThan(20);
                expect(group.description).toContain("for");
            }
        });

        it("should differentiate between use cases", () => {
            const moneriumDesc =
                currencyOptions.find((g) => g.group === "Monerium")
                    ?.description || "";
            const circleDesc =
                currencyOptions.find((g) => g.group === "Circle")
                    ?.description || "";

            expect(moneriumDesc).toContain("IBAN");
            expect(circleDesc).toContain("blockchain");
        });
    });
});
