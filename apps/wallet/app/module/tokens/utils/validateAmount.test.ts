import type { BalanceItem } from "@frak-labs/wallet-shared";
import type { Address } from "viem";
import { vi } from "vitest";
import { validateAmount } from "@/module/tokens/utils/validateAmount";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

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
    const createMockToken = (address: Address): BalanceItem => ({
        token: address,
        name: "Test Token",
        symbol: "TEST",
        decimals: 18,
        rawBalance: "0x0",
        amount: 100,
        eurAmount: 100,
        usdAmount: 100,
        gbpAmount: 100,
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should return true for valid amount", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("50", mockToken);
        expect(result).toBe(true);
    });

    test("should return true for amount equal to balance", ({
        mockAddress,
    }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("100", mockToken);
        expect(result).toBe(true);
    });

    test("should return error for zero amount", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("0", mockToken);
        expect(result).toBe("Amount must be positive");
    });

    test("should return error for negative amount", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("-10", mockToken);
        expect(result).toBe("Amount must be positive");
    });

    test("should return error for amount exceeding balance", ({
        mockAddress,
    }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("150", mockToken);
        expect(result).toBe("Amount must be less than balance");
    });

    test("should handle decimal amounts", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("99.99", mockToken);
        expect(result).toBe(true);
    });

    test("should handle small decimal amounts", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("0.001", mockToken);
        expect(result).toBe(true);
    });

    test("should return error for decimal amount exceeding balance", ({
        mockAddress,
    }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("100.01", mockToken);
        expect(result).toBe("Amount must be less than balance");
    });

    test("should handle string amounts", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("25.5", mockToken);
        expect(result).toBe(true);
    });

    test("should handle token with zero balance", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const emptyToken = { ...mockToken, amount: 0 };
        const result = validateAmount("1", emptyToken);
        expect(result).toBe("Amount must be less than balance");
    });

    test("should handle very small amounts", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("0.00001", mockToken);
        expect(result).toBe(true);
    });

    test("should handle scientific notation", ({ mockAddress }) => {
        const mockToken = createMockToken(mockAddress);
        const result = validateAmount("1e-5", mockToken);
        expect(result).toBe(true);
    });
});
