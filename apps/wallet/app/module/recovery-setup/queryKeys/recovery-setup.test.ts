import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { recoverySetupKey } from "./recovery-setup";

describe("recoverySetupKey", () => {
    describe("status", () => {
        it("should generate key with address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result = recoverySetupKey.status(address);

            expect(result).toEqual(["recovery-setup", "status", address]);
        });

        it("should generate key with no-address fallback when address is undefined", () => {
            const result = recoverySetupKey.status(undefined);

            expect(result).toEqual(["recovery-setup", "status", "no-address"]);
        });

        it("should generate key with no-address fallback when no address provided", () => {
            const result = recoverySetupKey.status();

            expect(result).toEqual(["recovery-setup", "status", "no-address"]);
        });

        it("should return array with exactly 3 elements", () => {
            const result = recoverySetupKey.status("0xabc" as Hex);

            expect(result).toHaveLength(3);
        });

        it("should include base key as first element", () => {
            const result = recoverySetupKey.status("0xabc" as Hex);

            expect(result[0]).toBe("recovery-setup");
            expect(result[1]).toBe("status");
        });

        it("should be deterministic for same address", () => {
            const address = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const result1 = recoverySetupKey.status(address);
            const result2 = recoverySetupKey.status(address);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different addresses", () => {
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
            it("should return constant mutation key", () => {
                expect(recoverySetupKey.downloadRecoveryFile).toEqual([
                    "recovery-setup",
                    "download-file",
                ]);
            });

            it("should be an array with 2 elements", () => {
                expect(recoverySetupKey.downloadRecoveryFile).toHaveLength(2);
            });

            it("should have recovery-setup as base key", () => {
                expect(recoverySetupKey.downloadRecoveryFile[0]).toBe(
                    "recovery-setup"
                );
            });

            it("should always return the same reference", () => {
                const ref1 = recoverySetupKey.downloadRecoveryFile;
                const ref2 = recoverySetupKey.downloadRecoveryFile;

                expect(ref1).toBe(ref2);
            });
        });

        describe("generateFile", () => {
            it("should return constant mutation key", () => {
                expect(recoverySetupKey.generateFile).toEqual([
                    "recovery-setup",
                    "generate-file",
                ]);
            });

            it("should be an array with 2 elements", () => {
                expect(recoverySetupKey.generateFile).toHaveLength(2);
            });

            it("should have recovery-setup as base key", () => {
                expect(recoverySetupKey.generateFile[0]).toBe("recovery-setup");
            });

            it("should always return the same reference", () => {
                const ref1 = recoverySetupKey.generateFile;
                const ref2 = recoverySetupKey.generateFile;

                expect(ref1).toBe(ref2);
            });
        });

        describe("setup", () => {
            it("should generate key with address", () => {
                const address =
                    "0x1234567890abcdef1234567890abcdef12345678" as Hex;
                const result = recoverySetupKey.setup(address);

                expect(result).toEqual(["recovery-setup", "setup", address]);
            });

            it("should generate key with no-address fallback when address is undefined", () => {
                const result = recoverySetupKey.setup(undefined);

                expect(result).toEqual([
                    "recovery-setup",
                    "setup",
                    "no-address",
                ]);
            });

            it("should generate key with no-address fallback when no address provided", () => {
                const result = recoverySetupKey.setup();

                expect(result).toEqual([
                    "recovery-setup",
                    "setup",
                    "no-address",
                ]);
            });

            it("should be deterministic for same address", () => {
                const address =
                    "0x1234567890abcdef1234567890abcdef12345678" as Hex;
                const result1 = recoverySetupKey.setup(address);
                const result2 = recoverySetupKey.setup(address);

                expect(result1).toEqual(result2);
            });

            it("should generate different keys for different addresses", () => {
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
