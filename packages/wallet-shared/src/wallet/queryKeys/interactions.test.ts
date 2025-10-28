import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { interactionsKey } from "./interactions";

describe("interactionsKey", () => {
    describe("sessionStatus", () => {
        describe("baseKey", () => {
            it("should return base key array", () => {
                expect(interactionsKey.sessionStatus.baseKey).toEqual([
                    "interactions",
                    "session-status",
                ]);
            });

            it("should be a readonly tuple", () => {
                expect(
                    Array.isArray(interactionsKey.sessionStatus.baseKey)
                ).toBe(true);
                expect(interactionsKey.sessionStatus.baseKey).toHaveLength(2);
            });

            it("should always return the same reference", () => {
                const ref1 = interactionsKey.sessionStatus.baseKey;
                const ref2 = interactionsKey.sessionStatus.baseKey;

                expect(ref1).toBe(ref2);
            });
        });

        describe("byAddress", () => {
            it("should generate key with valid address", () => {
                const address =
                    "0x1234567890abcdef1234567890abcdef12345678" as Hex;
                const result = interactionsKey.sessionStatus.byAddress(address);

                expect(result).toEqual([
                    "interactions",
                    "session-status",
                    address,
                ]);
            });

            it("should generate key with no-address fallback when address is undefined", () => {
                const result =
                    interactionsKey.sessionStatus.byAddress(undefined);

                expect(result).toEqual([
                    "interactions",
                    "session-status",
                    "no-address",
                ]);
            });

            it("should generate key with no-address fallback when no address provided", () => {
                const result = interactionsKey.sessionStatus.byAddress();

                expect(result).toEqual([
                    "interactions",
                    "session-status",
                    "no-address",
                ]);
            });

            it("should return array with exactly 3 elements", () => {
                const result = interactionsKey.sessionStatus.byAddress(
                    "0xabc" as Hex
                );

                expect(result).toHaveLength(3);
            });

            it("should be deterministic for same address", () => {
                const address =
                    "0x1234567890abcdef1234567890abcdef12345678" as Hex;
                const result1 =
                    interactionsKey.sessionStatus.byAddress(address);
                const result2 =
                    interactionsKey.sessionStatus.byAddress(address);

                expect(result1).toEqual(result2);
            });

            it("should generate different keys for different addresses", () => {
                const address1 =
                    "0x1111111111111111111111111111111111111111" as Hex;
                const address2 =
                    "0x2222222222222222222222222222222222222222" as Hex;

                const result1 =
                    interactionsKey.sessionStatus.byAddress(address1);
                const result2 =
                    interactionsKey.sessionStatus.byAddress(address2);

                expect(result1).not.toEqual(result2);
            });
        });
    });

    describe("mutation keys", () => {
        describe("closeSession", () => {
            it("should return constant mutation key", () => {
                expect(interactionsKey.closeSession).toEqual([
                    "interactions",
                    "close-session",
                ]);
            });

            it("should be an array with 2 elements", () => {
                expect(interactionsKey.closeSession).toHaveLength(2);
            });

            it("should always return the same reference", () => {
                const ref1 = interactionsKey.closeSession;
                const ref2 = interactionsKey.closeSession;

                expect(ref1).toBe(ref2);
            });
        });

        describe("openSession", () => {
            it("should return constant mutation key", () => {
                expect(interactionsKey.openSession).toEqual([
                    "interactions",
                    "open-session",
                ]);
            });

            it("should be an array with 2 elements", () => {
                expect(interactionsKey.openSession).toHaveLength(2);
            });

            it("should always return the same reference", () => {
                const ref1 = interactionsKey.openSession;
                const ref2 = interactionsKey.openSession;

                expect(ref1).toBe(ref2);
            });
        });

        describe("consumePending", () => {
            it("should return constant mutation key", () => {
                expect(interactionsKey.consumePending).toEqual([
                    "interactions",
                    "consume-pending",
                ]);
            });

            it("should be an array with 2 elements", () => {
                expect(interactionsKey.consumePending).toHaveLength(2);
            });

            it("should always return the same reference", () => {
                const ref1 = interactionsKey.consumePending;
                const ref2 = interactionsKey.consumePending;

                expect(ref1).toBe(ref2);
            });
        });
    });
});
