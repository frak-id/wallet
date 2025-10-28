import type { BalanceItem } from "@frak-labs/wallet-shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateAmount } from "@/module/tokens/utils/validateAmount";

// Mock i18next
vi.mock("i18next", () => ({
    t: vi.fn((key: string) => {
        const translations: Record<string, string> = {
            "wallet.tokens.amountPositive": "Amount must be positive",
            "wallet.tokens.amountLessThanBalance":
                "Amount must be less than balance",
        };
        return translations[key] || key;
    }),
}));

describe("validateAmount", () => {
    const mockToken: BalanceItem = {
        token: "0x1234567890123456789012345678901234567890",
        name: "Test Token",
        symbol: "TEST",
        decimals: 18,
        rawBalance: "0x0",
        amount: 100,
        eurAmount: 100,
        usdAmount: 100,
        gbpAmount: 100,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return true for valid amount", () => {
        const result = validateAmount("50", mockToken);
        expect(result).toBe(true);
    });

    it("should return true for amount equal to balance", () => {
        const result = validateAmount("100", mockToken);
        expect(result).toBe(true);
    });

    it("should return error for zero amount", () => {
        const result = validateAmount("0", mockToken);
        expect(result).toBe("Amount must be positive");
    });

    it("should return error for negative amount", () => {
        const result = validateAmount("-10", mockToken);
        expect(result).toBe("Amount must be positive");
    });

    it("should return error for amount exceeding balance", () => {
        const result = validateAmount("150", mockToken);
        expect(result).toBe("Amount must be less than balance");
    });

    it("should handle decimal amounts", () => {
        const result = validateAmount("99.99", mockToken);
        expect(result).toBe(true);
    });

    it("should handle small decimal amounts", () => {
        const result = validateAmount("0.001", mockToken);
        expect(result).toBe(true);
    });

    it("should return error for decimal amount exceeding balance", () => {
        const result = validateAmount("100.01", mockToken);
        expect(result).toBe("Amount must be less than balance");
    });

    it("should handle string amounts", () => {
        const result = validateAmount("25.5", mockToken);
        expect(result).toBe(true);
    });

    it("should handle token with zero balance", () => {
        const emptyToken = { ...mockToken, amount: 0 };
        const result = validateAmount("1", emptyToken);
        expect(result).toBe("Amount must be less than balance");
    });

    it("should handle very small amounts", () => {
        const result = validateAmount("0.00001", mockToken);
        expect(result).toBe(true);
    });

    it("should handle scientific notation", () => {
        const result = validateAmount("1e-5", mockToken);
        expect(result).toBe(true);
    });
});
