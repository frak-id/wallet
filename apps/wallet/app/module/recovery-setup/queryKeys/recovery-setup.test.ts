import type { Hex } from "viem";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { recoverySetupKey } from "./recovery-setup";

describe("recoverySetupKey", () => {
    describe("status", () => {
        test("should generate key with address", ({ mockAddress }) => {
            const result = recoverySetupKey.status(mockAddress);

            expect(result).toEqual(["recovery-setup", "status", mockAddress]);
        });

        test("should generate key with no-address fallback when address is undefined", () => {
            const result = recoverySetupKey.status(undefined);

            expect(result).toEqual(["recovery-setup", "status", "no-address"]);
        });

        test("should generate key with no-address fallback when no address provided", () => {
            const result = recoverySetupKey.status();

            expect(result).toEqual(["recovery-setup", "status", "no-address"]);
        });

        test("should return array with exactly 3 elements", () => {
            const result = recoverySetupKey.status("0xabc" as Hex);

            expect(result).toHaveLength(3);
        });

        test("should include base key as first element", () => {
            const result = recoverySetupKey.status("0xabc" as Hex);

            expect(result[0]).toBe("recovery-setup");
            expect(result[1]).toBe("status");
        });

        test("should be deterministic for same address", ({ mockAddress }) => {
            const result1 = recoverySetupKey.status(mockAddress);
            const result2 = recoverySetupKey.status(mockAddress);

            expect(result1).toEqual(result2);
        });

        test("should generate different keys for different addresses", () => {
            const address1 =
                "0x1111111111111111111111111111111111111111" as Hex;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Hex;

            const result1 = recoverySetupKey.status(address1);
            const result2 = recoverySetupKey.status(address2);

            expect(result1).not.toEqual(result2);
        });
    });

    describe("mutation keys", () => {
        describe("downloadRecoveryFile", () => {
            test("should return constant mutation key", () => {
                expect(recoverySetupKey.downloadRecoveryFile).toEqual([
                    "recovery-setup",
                    "download-file",
                ]);
            });

            test("should be an array with 2 elements", () => {
                expect(recoverySetupKey.downloadRecoveryFile).toHaveLength(2);
            });

            test("should have recovery-setup as base key", () => {
                expect(recoverySetupKey.downloadRecoveryFile[0]).toBe(
                    "recovery-setup"
                );
            });

            test("should always return the same reference", () => {
                const ref1 = recoverySetupKey.downloadRecoveryFile;
                const ref2 = recoverySetupKey.downloadRecoveryFile;

                expect(ref1).toBe(ref2);
            });
        });

        describe("generateFile", () => {
            test("should return constant mutation key", () => {
                expect(recoverySetupKey.generateFile).toEqual([
                    "recovery-setup",
                    "generate-file",
                ]);
            });

            test("should be an array with 2 elements", () => {
                expect(recoverySetupKey.generateFile).toHaveLength(2);
            });

            test("should have recovery-setup as base key", () => {
                expect(recoverySetupKey.generateFile[0]).toBe("recovery-setup");
            });

            test("should always return the same reference", () => {
                const ref1 = recoverySetupKey.generateFile;
                const ref2 = recoverySetupKey.generateFile;

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
