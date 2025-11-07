import type { BalanceItem } from "@frak-labs/wallet-shared";
import { type Address, getAddress, zeroAddress } from "viem";
import { getUpdatedToken } from "@/module/tokens/utils/getUpdatedToken";
import { describe, expect, test } from "@/tests/vitest-fixtures";

describe("getUpdatedToken", () => {
    const mockTokenAddress2 =
        "0xabcdef1234567890123456789012345678901234" as Address;

    const createToken = (address: Address, amount: number): BalanceItem => ({
        token: address,
        name: "Test Token",
        symbol: "TEST",
        decimals: 18,
        rawBalance: "0x0",
        amount,
        eurAmount: amount,
        usdAmount: amount,
        gbpAmount: amount,
    });

    test("should return updated token when amount changes", ({
        mockAddress,
    }) => {
        const selectedToken = createToken(mockAddress, 100);
        const tokens = [
            createToken(mockAddress, 150), // Updated amount
            createToken(mockTokenAddress2, 50),
        ];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.token).toBe(mockAddress);
        expect(result?.amount).toBe(150);
    });

    test("should return undefined when amount has not changed", ({
        mockAddress,
    }) => {
        const selectedToken = createToken(mockAddress, 100);
        const tokens = [
            createToken(mockAddress, 100), // Same amount
            createToken(mockTokenAddress2, 50),
        ];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeUndefined();
    });

    test("should return undefined when token not found in list", ({
        mockAddress,
    }) => {
        const selectedToken = createToken(mockAddress, 100);
        const tokens = [
            createToken(mockTokenAddress2, 50),
            createToken("0x9999999999999999999999999999999999999999", 25),
        ];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeUndefined();
    });

    test("should handle empty token list", ({ mockAddress }) => {
        const selectedToken = createToken(mockAddress, 100);
        const tokens: BalanceItem[] = [];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeUndefined();
    });

    test("should compare addresses case-insensitively using checksummed addresses", ({
        mockAddress,
    }) => {
        // Use getAddress to ensure proper checksumming
        const checksummedAddress = getAddress(mockAddress);
        const selectedToken = createToken(checksummedAddress, 100);
        const tokens = [createToken(checksummedAddress, 150)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(150);
    });

    test("should handle zero address", () => {
        const selectedToken = createToken(zeroAddress, 100);
        const tokens = [createToken(zeroAddress, 150)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(150);
    });

    test("should return first matching token when multiple exist", ({
        mockAddress,
    }) => {
        const selectedToken = createToken(mockAddress, 100);
        const tokens = [
            createToken(mockAddress, 150), // First match
            createToken(mockAddress, 200), // Second match (should not be returned)
            createToken(mockTokenAddress2, 50),
        ];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(150);
    });

    test("should handle amount changes from zero", ({ mockAddress }) => {
        const selectedToken = createToken(mockAddress, 0);
        const tokens = [createToken(mockAddress, 100)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(100);
    });

    test("should handle amount changes to zero", ({ mockAddress }) => {
        const selectedToken = createToken(mockAddress, 100);
        const tokens = [createToken(mockAddress, 0)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(0);
    });

    test("should handle decimal amounts", ({ mockAddress }) => {
        const selectedToken = createToken(mockAddress, 99.5);
        const tokens = [createToken(mockAddress, 100.75)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(100.75);
    });

    test("should handle very small decimal amounts", ({ mockAddress }) => {
        const selectedToken = createToken(mockAddress, 0.000001);
        const tokens = [createToken(mockAddress, 0.000002)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(0.000002);
    });

    test("should handle large amounts", ({ mockAddress }) => {
        const selectedToken = createToken(mockAddress, 1000000);
        const tokens = [createToken(mockAddress, 2000000)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(2000000);
    });
});
