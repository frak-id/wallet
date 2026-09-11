import type { BalanceItem } from "@frak-labs/wallet-shared";
import type { Address } from "viem";
import { vi } from "vitest";
import { validateAmount } from "@/module/tokens/utils/validateAmount";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

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
    const token: BalanceItem = {
        token: "0x1111111111111111111111111111111111111111" as Address,
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

    const cases: [string, string | true][] = [
        ["50", true],
        ["100", true],
        ["99.99", true],
        ["1e-5", true],
        ["0", "Amount must be positive"],
        ["-10", "Amount must be positive"],
        ["150", "Amount must be less than balance"],
        ["100.01", "Amount must be less than balance"],
    ];

    test.each(cases)("validates %s as %s", (amount, expected) => {
        expect(validateAmount(amount, token)).toBe(expected);
    });

    test("rejects any amount on a token with a zero balance", () => {
        expect(validateAmount("1", { ...token, amount: 0 })).toBe(
            "Amount must be less than balance"
        );
    });
});
