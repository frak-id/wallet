import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { historyKey } from "./history";

describe("historyKey", () => {
    describe("interactions.byAddress", () => {
        it("should generate key with valid address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result = historyKey.interactions.byAddress(address);

            expect(result).toEqual(["history", "interactions", address]);
        });

        it("should generate key with no-address fallback when address is undefined", () => {
            const result = historyKey.interactions.byAddress(undefined);

            expect(result).toEqual(["history", "interactions", "no-address"]);
        });

        it("should generate key with no-address fallback when no address provided", () => {
            const result = historyKey.interactions.byAddress();

            expect(result).toEqual(["history", "interactions", "no-address"]);
        });

        it("should return array with exactly 3 elements", () => {
            const result = historyKey.interactions.byAddress("0xabc" as Hex);

            expect(result).toHaveLength(3);
        });

        it("should include base keys as first two elements", () => {
            const result = historyKey.interactions.byAddress("0xabc" as Hex);

            expect(result[0]).toBe("history");
            expect(result[1]).toBe("interactions");
        });

        it("should be deterministic for same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result1 = historyKey.interactions.byAddress(address);
            const result2 = historyKey.interactions.byAddress(address);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = historyKey.interactions.byAddress(address1);
            const result2 = historyKey.interactions.byAddress(address2);

            expect(result1).not.toEqual(result2);
        });

        it("should handle zero address", () => {
            const zeroAddress =
                "0x0000000000000000000000000000000000000000" as Hex;
            const result = historyKey.interactions.byAddress(zeroAddress);

            expect(result).toEqual(["history", "interactions", zeroAddress]);
        });
    });

    describe("rewards.byAddress", () => {
        it("should generate key with valid address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result = historyKey.rewards.byAddress(address);

            expect(result).toEqual(["history", "rewards", address]);
        });

        it("should generate key with no-address fallback when address is undefined", () => {
            const result = historyKey.rewards.byAddress(undefined);

            expect(result).toEqual(["history", "rewards", "no-address"]);
        });

        it("should generate key with no-address fallback when no address provided", () => {
            const result = historyKey.rewards.byAddress();

            expect(result).toEqual(["history", "rewards", "no-address"]);
        });

        it("should return array with exactly 3 elements", () => {
            const result = historyKey.rewards.byAddress("0xabc" as Hex);

            expect(result).toHaveLength(3);
        });

        it("should include base keys as first two elements", () => {
            const result = historyKey.rewards.byAddress("0xabc" as Hex);

            expect(result[0]).toBe("history");
            expect(result[1]).toBe("rewards");
        });

        it("should be deterministic for same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result1 = historyKey.rewards.byAddress(address);
            const result2 = historyKey.rewards.byAddress(address);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = historyKey.rewards.byAddress(address1);
            const result2 = historyKey.rewards.byAddress(address2);

            expect(result1).not.toEqual(result2);
        });

        it("should handle zero address", () => {
            const zeroAddress =
                "0x0000000000000000000000000000000000000000" as Hex;
            const result = historyKey.rewards.byAddress(zeroAddress);

            expect(result).toEqual(["history", "rewards", zeroAddress]);
        });
    });

    describe("interactions vs rewards keys", () => {
        it("should generate different keys for interactions and rewards with same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const interactionsKey = historyKey.interactions.byAddress(address);
            const rewardsKey = historyKey.rewards.byAddress(address);

            expect(interactionsKey).not.toEqual(rewardsKey);
            expect(interactionsKey[1]).toBe("interactions");
            expect(rewardsKey[1]).toBe("rewards");
        });
    });
});
