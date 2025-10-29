import type { Hex } from "viem";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { historyKey } from "./history";

describe("historyKey", () => {
    describe("interactions.byAddress", () => {
        test("should generate key with valid address", ({ mockAddress }) => {
            const result = historyKey.interactions.byAddress(mockAddress);

            expect(result).toEqual(["history", "interactions", mockAddress]);
        });

        test("should generate key with no-address fallback when address is undefined", () => {
            const result = historyKey.interactions.byAddress(undefined);

            expect(result).toEqual(["history", "interactions", "no-address"]);
        });

        test("should generate key with no-address fallback when no address provided", () => {
            const result = historyKey.interactions.byAddress();

            expect(result).toEqual(["history", "interactions", "no-address"]);
        });

        test("should return array with exactly 3 elements", () => {
            const result = historyKey.interactions.byAddress("0xabc" as Hex);

            expect(result).toHaveLength(3);
        });

        test("should include base keys as first two elements", () => {
            const result = historyKey.interactions.byAddress("0xabc" as Hex);

            expect(result[0]).toBe("history");
            expect(result[1]).toBe("interactions");
        });

        test("should be deterministic for same address", ({ mockAddress }) => {
            const result1 = historyKey.interactions.byAddress(mockAddress);
            const result2 = historyKey.interactions.byAddress(mockAddress);

            expect(result1).toEqual(result2);
        });

        test("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = historyKey.interactions.byAddress(address1);
            const result2 = historyKey.interactions.byAddress(address2);

            expect(result1).not.toEqual(result2);
        });

        test("should handle zero address", () => {
            const zeroAddress =
                "0x0000000000000000000000000000000000000000" as Hex;
            const result = historyKey.interactions.byAddress(zeroAddress);

            expect(result).toEqual(["history", "interactions", zeroAddress]);
        });
    });

    describe("rewards.byAddress", () => {
        test("should generate key with valid address", ({ mockAddress }) => {
            const result = historyKey.rewards.byAddress(mockAddress);

            expect(result).toEqual(["history", "rewards", mockAddress]);
        });

        test("should generate key with no-address fallback when address is undefined", () => {
            const result = historyKey.rewards.byAddress(undefined);

            expect(result).toEqual(["history", "rewards", "no-address"]);
        });

        test("should generate key with no-address fallback when no address provided", () => {
            const result = historyKey.rewards.byAddress();

            expect(result).toEqual(["history", "rewards", "no-address"]);
        });

        test("should return array with exactly 3 elements", () => {
            const result = historyKey.rewards.byAddress("0xabc" as Hex);

            expect(result).toHaveLength(3);
        });

        test("should include base keys as first two elements", () => {
            const result = historyKey.rewards.byAddress("0xabc" as Hex);

            expect(result[0]).toBe("history");
            expect(result[1]).toBe("rewards");
        });

        test("should be deterministic for same address", ({ mockAddress }) => {
            const result1 = historyKey.rewards.byAddress(mockAddress);
            const result2 = historyKey.rewards.byAddress(mockAddress);

            expect(result1).toEqual(result2);
        });

        test("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = historyKey.rewards.byAddress(address1);
            const result2 = historyKey.rewards.byAddress(address2);

            expect(result1).not.toEqual(result2);
        });

        test("should handle zero address", () => {
            const zeroAddress =
                "0x0000000000000000000000000000000000000000" as Hex;
            const result = historyKey.rewards.byAddress(zeroAddress);

            expect(result).toEqual(["history", "rewards", zeroAddress]);
        });
    });

    describe("interactions vs rewards keys", () => {
        test("should generate different keys for interactions and rewards with same address", ({
            mockAddress,
        }) => {
            const interactionsKey =
                historyKey.interactions.byAddress(mockAddress);
            const rewardsKey = historyKey.rewards.byAddress(mockAddress);

            expect(interactionsKey).not.toEqual(rewardsKey);
            expect(interactionsKey[1]).toBe("interactions");
            expect(rewardsKey[1]).toBe("rewards");
        });
    });
});
