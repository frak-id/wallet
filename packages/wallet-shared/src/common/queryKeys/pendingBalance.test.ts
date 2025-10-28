import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { pendingBalanceKey } from "./pendingBalance";

describe("pendingBalanceKey", () => {
    describe("byAddress", () => {
        it("should generate key with valid address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result = pendingBalanceKey.byAddress(address);

            expect(result).toEqual(["pending-balance", address]);
        });

        it("should generate key with no-address fallback when address is undefined", () => {
            const result = pendingBalanceKey.byAddress(undefined);

            expect(result).toEqual(["pending-balance", "no-address"]);
        });

        it("should generate key with no-address fallback when no address provided", () => {
            const result = pendingBalanceKey.byAddress();

            expect(result).toEqual(["pending-balance", "no-address"]);
        });

        it("should return array with exactly 2 elements", () => {
            const result = pendingBalanceKey.byAddress("0xabc" as Hex);

            expect(result).toHaveLength(2);
        });

        it("should include base key as first element", () => {
            const result = pendingBalanceKey.byAddress("0xabc" as Hex);

            expect(result[0]).toBe("pending-balance");
        });

        it("should be deterministic for same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result1 = pendingBalanceKey.byAddress(address);
            const result2 = pendingBalanceKey.byAddress(address);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = pendingBalanceKey.byAddress(address1);
            const result2 = pendingBalanceKey.byAddress(address2);

            expect(result1).not.toEqual(result2);
        });

        it("should handle zero address", () => {
            const zeroAddress =
                "0x0000000000000000000000000000000000000000" as Hex;
            const result = pendingBalanceKey.byAddress(zeroAddress);

            expect(result).toEqual(["pending-balance", zeroAddress]);
        });
    });
});
