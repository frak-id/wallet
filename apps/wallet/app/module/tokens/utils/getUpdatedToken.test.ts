import type { BalanceItem } from "@frak-labs/wallet-shared";
import { type Address, getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { getUpdatedToken } from "@/module/tokens/utils/getUpdatedToken";

describe("getUpdatedToken", () => {
    const mockTokenAddress =
        "0x1234567890123456789012345678901234567890" as Address;
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

    it("should return updated token when amount changes", () => {
        const selectedToken = createToken(mockTokenAddress, 100);
        const tokens = [
            createToken(mockTokenAddress, 150), // Updated amount
            createToken(mockTokenAddress2, 50),
        ];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.token).toBe(mockTokenAddress);
        expect(result?.amount).toBe(150);
    });

    it("should return undefined when amount has not changed", () => {
        const selectedToken = createToken(mockTokenAddress, 100);
        const tokens = [
            createToken(mockTokenAddress, 100), // Same amount
            createToken(mockTokenAddress2, 50),
        ];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeUndefined();
    });

    it("should return undefined when token not found in list", () => {
        const selectedToken = createToken(mockTokenAddress, 100);
        const tokens = [
            createToken(mockTokenAddress2, 50),
            createToken("0x9999999999999999999999999999999999999999", 25),
        ];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeUndefined();
    });

    it("should handle empty token list", () => {
        const selectedToken = createToken(mockTokenAddress, 100);
        const tokens: BalanceItem[] = [];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeUndefined();
    });

    it("should compare addresses case-insensitively using checksummed addresses", () => {
        // Use getAddress to ensure proper checksumming
        const checksummedAddress = getAddress(mockTokenAddress);
        const selectedToken = createToken(checksummedAddress, 100);
        const tokens = [createToken(checksummedAddress, 150)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(150);
    });

    it("should handle zero address", () => {
        const selectedToken = createToken(zeroAddress, 100);
        const tokens = [createToken(zeroAddress, 150)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(150);
    });

    it("should return first matching token when multiple exist", () => {
        const selectedToken = createToken(mockTokenAddress, 100);
        const tokens = [
            createToken(mockTokenAddress, 150), // First match
            createToken(mockTokenAddress, 200), // Second match (should not be returned)
            createToken(mockTokenAddress2, 50),
        ];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(150);
    });

    it("should handle amount changes from zero", () => {
        const selectedToken = createToken(mockTokenAddress, 0);
        const tokens = [createToken(mockTokenAddress, 100)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(100);
    });

    it("should handle amount changes to zero", () => {
        const selectedToken = createToken(mockTokenAddress, 100);
        const tokens = [createToken(mockTokenAddress, 0)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(0);
    });

    it("should handle decimal amounts", () => {
        const selectedToken = createToken(mockTokenAddress, 99.5);
        const tokens = [createToken(mockTokenAddress, 100.75)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(100.75);
    });

    it("should handle very small decimal amounts", () => {
        const selectedToken = createToken(mockTokenAddress, 0.000001);
        const tokens = [createToken(mockTokenAddress, 0.000002)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(0.000002);
    });

    it("should handle large amounts", () => {
        const selectedToken = createToken(mockTokenAddress, 1000000);
        const tokens = [createToken(mockTokenAddress, 2000000)];

        const result = getUpdatedToken({ tokens, selectedToken });

        expect(result).toBeDefined();
        expect(result?.amount).toBe(2000000);
    });
});
