import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { claimableKey } from "./claimable";

describe("claimableKey", () => {
    describe("pending.byAddress", () => {
        it("should generate key with valid address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result = claimableKey.pending.byAddress(address);

            expect(result).toEqual(["claimable", "pending", address]);
        });

        it("should generate key with no-address fallback when address is undefined", () => {
            const result = claimableKey.pending.byAddress(undefined);

            expect(result).toEqual(["claimable", "pending", "no-address"]);
        });

        it("should generate key with no-address fallback when no address provided", () => {
            const result = claimableKey.pending.byAddress();

            expect(result).toEqual(["claimable", "pending", "no-address"]);
        });

        it("should return array with exactly 3 elements", () => {
            const result = claimableKey.pending.byAddress("0xabc" as Hex);

            expect(result).toHaveLength(3);
        });

        it("should include base keys as first two elements", () => {
            const result = claimableKey.pending.byAddress("0xabc" as Hex);

            expect(result[0]).toBe("claimable");
            expect(result[1]).toBe("pending");
        });

        it("should be deterministic for same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result1 = claimableKey.pending.byAddress(address);
            const result2 = claimableKey.pending.byAddress(address);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = claimableKey.pending.byAddress(address1);
            const result2 = claimableKey.pending.byAddress(address2);

            expect(result1).not.toEqual(result2);
        });
    });

    describe("claim.byAddress", () => {
        it("should generate key with valid address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result = claimableKey.claim.byAddress(address);

            expect(result).toEqual(["claimable", "do-claim", address]);
        });

        it("should generate key with no-address fallback when address is undefined", () => {
            const result = claimableKey.claim.byAddress(undefined);

            expect(result).toEqual(["claimable", "do-claim", "no-address"]);
        });

        it("should generate key with no-address fallback when no address provided", () => {
            const result = claimableKey.claim.byAddress();

            expect(result).toEqual(["claimable", "do-claim", "no-address"]);
        });

        it("should return array with exactly 3 elements", () => {
            const result = claimableKey.claim.byAddress("0xabc" as Hex);

            expect(result).toHaveLength(3);
        });

        it("should include base keys as first two elements", () => {
            const result = claimableKey.claim.byAddress("0xabc" as Hex);

            expect(result[0]).toBe("claimable");
            expect(result[1]).toBe("do-claim");
        });

        it("should be deterministic for same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result1 = claimableKey.claim.byAddress(address);
            const result2 = claimableKey.claim.byAddress(address);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = claimableKey.claim.byAddress(address1);
            const result2 = claimableKey.claim.byAddress(address2);

            expect(result1).not.toEqual(result2);
        });
    });

    describe("pending vs claim keys", () => {
        it("should generate different keys for pending and claim with same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const pendingKey = claimableKey.pending.byAddress(address);
            const claimKey = claimableKey.claim.byAddress(address);

            expect(pendingKey).not.toEqual(claimKey);
            expect(pendingKey[1]).toBe("pending");
            expect(claimKey[1]).toBe("do-claim");
        });
    });
});
