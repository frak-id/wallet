import { describe, expect, it } from "vitest";
import {
    currencyMetadata,
    currencyOptions,
    formatTokenBalance,
} from "./currencyOptions";

describe("currencyOptions", () => {
    describe("data structure", () => {
        it("should have 2 groups (Monerium, Circle)", () => {
            expect(currencyOptions).toHaveLength(2);
            expect(currencyOptions[0].group).toBe("Monerium");
            expect(currencyOptions[1].group).toBe("Circle");
        });

        it("should have Monerium group with 3 options (eure, gbpe, usde)", () => {
            const moneyiumGroup = currencyOptions[0];
            expect(moneyiumGroup.options).toHaveLength(3);
            expect(moneyiumGroup.options[0].value).toBe("eure");
            expect(moneyiumGroup.options[1].value).toBe("gbpe");
            expect(moneyiumGroup.options[2].value).toBe("usde");
        });

        it("should have Circle group with 1 option (usdc)", () => {
            const circleGroup = currencyOptions[1];
            expect(circleGroup.options).toHaveLength(1);
            expect(circleGroup.options[0].value).toBe("usdc");
        });

        it("should have required fields on each option", () => {
            const requiredFields = [
                "value",
                "label",
                "currencySymbol",
                "currencyCode",
                "locale",
                "provider",
                "providerDescription",
            ];

            for (const group of currencyOptions) {
                for (const option of group.options) {
                    for (const field of requiredFields) {
                        expect(option).toHaveProperty(field);
                        expect(
                            option[field as keyof typeof option]
                        ).toBeDefined();
                    }
                }
            }
        });

        it("should have valid provider values", () => {
            for (const group of currencyOptions) {
                for (const option of group.options) {
                    expect(["Monerium", "Circle"]).toContain(option.provider);
                }
            }
        });
    });
});

describe("currencyMetadata", () => {
    describe("lookup structure", () => {
        it("should have entry for each stablecoin", () => {
            expect(currencyMetadata).toHaveProperty("eure");
            expect(currencyMetadata).toHaveProperty("gbpe");
            expect(currencyMetadata).toHaveProperty("usde");
            expect(currencyMetadata).toHaveProperty("usdc");
        });

        it("should map eure to EUR currency", () => {
            expect(currencyMetadata.eure.currencyCode).toBe("EUR");
            expect(currencyMetadata.eure.locale).toBe("fr-FR");
        });

        it("should map gbpe to GBP currency", () => {
            expect(currencyMetadata.gbpe.currencyCode).toBe("GBP");
            expect(currencyMetadata.gbpe.locale).toBe("en-GB");
        });

        it("should map usde to USD currency", () => {
            expect(currencyMetadata.usde.currencyCode).toBe("USD");
            expect(currencyMetadata.usde.locale).toBe("en-US");
        });

        it("should map usdc to USD currency", () => {
            expect(currencyMetadata.usdc.currencyCode).toBe("USD");
            expect(currencyMetadata.usdc.locale).toBe("en-US");
        });

        it("should have correct provider for each stablecoin", () => {
            expect(currencyMetadata.eure.provider).toBe("Monerium");
            expect(currencyMetadata.gbpe.provider).toBe("Monerium");
            expect(currencyMetadata.usde.provider).toBe("Monerium");
            expect(currencyMetadata.usdc.provider).toBe("Circle");
        });
    });
});

describe("formatTokenBalance", () => {
    describe("basic formatting", () => {
        it("should format eure balance with EUR symbol", () => {
            const result = formatTokenBalance(5000000n, "eure", 6);
            expect(result).toContain("€");
            expect(result).toContain("5");
        });

        it("should format usdc balance with USD symbol", () => {
            const result = formatTokenBalance(1000000n, "usdc", 6);
            expect(result).toContain("$");
            expect(result).toContain("1");
        });

        it("should format gbpe balance with GBP symbol", () => {
            const result = formatTokenBalance(1000000n, "gbpe", 6);
            expect(result).toContain("£");
            expect(result).toContain("1");
        });

        it("should format usde balance with USD symbol", () => {
            const result = formatTokenBalance(1000000n, "usde", 6);
            expect(result).toContain("$");
            expect(result).toContain("1");
        });
    });

    describe("decimal handling", () => {
        it("should handle zero balance", () => {
            const result = formatTokenBalance(0n, "usdc", 6);
            expect(result).toContain("$");
            expect(result).toContain("0");
        });

        it("should format with decimals when balance is not whole", () => {
            const result = formatTokenBalance(1500000n, "usdc", 6);
            expect(result).toContain("$");
            expect(result).toMatch(/1[.,\s]5/);
        });

        it("should not show decimals for whole numbers", () => {
            const result = formatTokenBalance(5000000n, "usdc", 6);
            expect(result).toContain("$");
            expect(result).toContain("5");
            // Should not have .00 for whole numbers
            expect(result).not.toMatch(/5[.,]0+$/);
        });
    });

    describe("large balances", () => {
        it("should handle large balances with thousand separators", () => {
            const result = formatTokenBalance(1000000000000n, "usdc", 6);
            expect(result).toContain("$");
            // Should contain 1 million with thousand separators
            expect(result).toMatch(/1[.,\s]000[.,\s]000/);
        });

        it("should format large balance with decimals", () => {
            const result = formatTokenBalance(1500000000000n, "usdc", 6);
            expect(result).toContain("$");
            // Should contain 1.5 million with thousand separators
            expect(result).toMatch(/1[.,\s]500[.,\s]000/);
        });
    });

    describe("locale-specific formatting", () => {
        it("should use fr-FR locale for eure", () => {
            const result = formatTokenBalance(1234567n, "eure", 6);
            expect(result).toContain("€");
            // French locale uses space or comma for thousands/decimals
            expect(result).toMatch(/1[.,\s]/);
        });

        it("should use en-GB locale for gbpe", () => {
            const result = formatTokenBalance(1234567n, "gbpe", 6);
            expect(result).toContain("£");
            // British locale uses comma for thousands
            expect(result).toMatch(/1[.,\s]/);
        });

        it("should use en-US locale for usdc", () => {
            const result = formatTokenBalance(1234567n, "usdc", 6);
            expect(result).toContain("$");
            // US locale uses comma for thousands
            expect(result).toMatch(/1[.,\s]/);
        });
    });

    describe("different decimal places", () => {
        it("should handle 18 decimals (standard ERC-20)", () => {
            // 1 token with 18 decimals
            const result = formatTokenBalance(1000000000000000000n, "usdc", 18);
            expect(result).toContain("$");
            expect(result).toContain("1");
        });

        it("should handle 8 decimals", () => {
            // 1 token with 8 decimals
            const result = formatTokenBalance(100000000n, "usdc", 8);
            expect(result).toContain("$");
            expect(result).toContain("1");
        });

        it("should handle 2 decimals", () => {
            // 1 token with 2 decimals
            const result = formatTokenBalance(100n, "usdc", 2);
            expect(result).toContain("$");
            expect(result).toContain("1");
        });
    });
});
