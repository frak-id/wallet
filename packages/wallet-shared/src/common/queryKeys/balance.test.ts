import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { balanceKey } from "./balance";

describe("balanceKey", () => {
    describe("baseKey", () => {
        it("should return base key array", () => {
            expect(balanceKey.baseKey).toEqual(["balance"]);
        });

        it("should be a readonly tuple", () => {
            expect(Array.isArray(balanceKey.baseKey)).toBe(true);
        });
    });

    describe("byAddress", () => {
        it("should generate key with valid address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result = balanceKey.byAddress(address);

            expect(result).toEqual(["balance", address]);
        });

        it("should generate key with no-address fallback when address is undefined", () => {
            const result = balanceKey.byAddress(undefined);

            expect(result).toEqual(["balance", "no-address"]);
        });

        it("should generate key with no-address fallback when no address provided", () => {
            const result = balanceKey.byAddress();

            expect(result).toEqual(["balance", "no-address"]);
        });

        it("should return array with exactly 2 elements", () => {
            const result = balanceKey.byAddress("0xabc" as Hex);

            expect(result).toHaveLength(2);
        });

        it("should include base key as first element", () => {
            const result = balanceKey.byAddress("0xabc" as Hex);

            expect(result[0]).toBe("balance");
        });

        it("should be deterministic for same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result1 = balanceKey.byAddress(address);
            const result2 = balanceKey.byAddress(address);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = balanceKey.byAddress(address1);
            const result2 = balanceKey.byAddress(address2);

            expect(result1).not.toEqual(result2);
        });
    });
});
