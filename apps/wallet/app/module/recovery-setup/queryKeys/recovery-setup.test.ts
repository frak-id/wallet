import type { Hex } from "viem";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { recoverySetupKey } from "./recovery-setup";

describe("recoverySetupKey", () => {
    describe("mutation keys", () => {
        describe("generateOptions", () => {
            test("should return constant mutation key", () => {
                expect(recoverySetupKey.generateOptions).toEqual([
                    "recovery-setup",
                    "generate-options",
                ]);
            });

            test("should be an array with 2 elements", () => {
                expect(recoverySetupKey.generateOptions).toHaveLength(2);
            });

            test("should have recovery-setup as base key", () => {
                expect(recoverySetupKey.generateOptions[0]).toBe(
                    "recovery-setup"
                );
            });

            test("should always return the same reference", () => {
                const ref1 = recoverySetupKey.generateOptions;
                const ref2 = recoverySetupKey.generateOptions;

                expect(ref1).toBe(ref2);
            });
        });

        describe("setup", () => {
            test("should generate key with address", ({ mockAddress }) => {
                const result = recoverySetupKey.setup(mockAddress);

                expect(result).toEqual([
                    "recovery-setup",
                    "setup",
                    mockAddress,
                ]);
            });

            test("should generate key with no-address fallback when address is undefined", () => {
                const result = recoverySetupKey.setup(undefined);

                expect(result).toEqual([
                    "recovery-setup",
                    "setup",
                    "no-address",
                ]);
            });

            test("should generate key with no-address fallback when no address provided", () => {
                const result = recoverySetupKey.setup();

                expect(result).toEqual([
                    "recovery-setup",
                    "setup",
                    "no-address",
                ]);
            });

            test("should be deterministic for same address", ({
                mockAddress,
            }) => {
                const result1 = recoverySetupKey.setup(mockAddress);
                const result2 = recoverySetupKey.setup(mockAddress);

                expect(result1).toEqual(result2);
            });

            test("should generate different keys for different addresses", () => {
                const address1 =
                    "0x1111111111111111111111111111111111111111" as Hex;
                const address2 =
                    "0x2222222222222222222222222222222222222222" as Hex;

                const result1 = recoverySetupKey.setup(address1);
                const result2 = recoverySetupKey.setup(address2);

                expect(result1).not.toEqual(result2);
            });
        });
    });
});
