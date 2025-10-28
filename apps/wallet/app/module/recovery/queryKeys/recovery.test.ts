import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { recoveryKey } from "./recovery";

describe("recoveryKey", () => {
    describe("availableChains.full", () => {
        it("should generate key with wallet and guardian addresses", () => {
            const walletAddress =
                "0x1234567890abcdef1234567890abcdef12345678" as Hex;
            const guardianAddress =
                "0xabcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result = recoveryKey.availableChains.full({
                walletAddress,
                guardianAddress,
            });

            expect(result).toEqual([
                "recovery",
                "get-available-chains",
                walletAddress,
                guardianAddress,
            ]);
        });

        it("should return array with exactly 4 elements", () => {
            const result = recoveryKey.availableChains.full({
                walletAddress: "0xabc" as Hex,
                guardianAddress: "0xdef" as Hex,
            });

            expect(result).toHaveLength(4);
        });

        it("should include base keys as first two elements", () => {
            const result = recoveryKey.availableChains.full({
                walletAddress: "0xabc" as Hex,
                guardianAddress: "0xdef" as Hex,
            });

            expect(result[0]).toBe("recovery");
            expect(result[1]).toBe("get-available-chains");
        });

        it("should be deterministic for same parameters", () => {
            const params = {
                walletAddress:
                    "0x1234567890abcdef1234567890abcdef12345678" as Hex,
                guardianAddress:
                    "0xabcdef1234567890abcdef1234567890abcdef12" as Hex,
            };

            const result1 = recoveryKey.availableChains.full(params);
            const result2 = recoveryKey.availableChains.full(params);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different wallet addresses", () => {
            const guardianAddress =
                "0xabcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result1 = recoveryKey.availableChains.full({
                walletAddress:
                    "0x1111111111111111111111111111111111111111" as Hex,
                guardianAddress,
            });
            const result2 = recoveryKey.availableChains.full({
                walletAddress:
                    "0x2222222222222222222222222222222222222222" as Hex,
                guardianAddress,
            });

            expect(result1).not.toEqual(result2);
        });

        it("should generate different keys for different guardian addresses", () => {
            const walletAddress =
                "0x1234567890abcdef1234567890abcdef12345678" as Hex;

            const result1 = recoveryKey.availableChains.full({
                walletAddress,
                guardianAddress:
                    "0x1111111111111111111111111111111111111111" as Hex,
            });
            const result2 = recoveryKey.availableChains.full({
                walletAddress,
                guardianAddress:
                    "0x2222222222222222222222222222222222222222" as Hex,
            });

            expect(result1).not.toEqual(result2);
        });

        it("should handle zero addresses", () => {
            const zeroAddress =
                "0x0000000000000000000000000000000000000000" as Hex;

            const result = recoveryKey.availableChains.full({
                walletAddress: zeroAddress,
                guardianAddress: zeroAddress,
            });

            expect(result).toEqual([
                "recovery",
                "get-available-chains",
                zeroAddress,
                zeroAddress,
            ]);
        });
    });

    describe("mutation keys", () => {
        describe("createRecoveryPasskey", () => {
            it("should return constant mutation key", () => {
                expect(recoveryKey.createRecoveryPasskey).toEqual([
                    "recovery",
                    "create-passkey",
                ]);
            });

            it("should be an array with 2 elements", () => {
                expect(recoveryKey.createRecoveryPasskey).toHaveLength(2);
            });

            it("should have recovery as base key", () => {
                expect(recoveryKey.createRecoveryPasskey[0]).toBe("recovery");
            });

            it("should always return the same reference", () => {
                const ref1 = recoveryKey.createRecoveryPasskey;
                const ref2 = recoveryKey.createRecoveryPasskey;

                expect(ref1).toBe(ref2);
            });
        });

        describe("performRecovery", () => {
            it("should return constant mutation key", () => {
                expect(recoveryKey.performRecovery).toEqual([
                    "recovery",
                    "perform-recovery",
                ]);
            });

            it("should be an array with 2 elements", () => {
                expect(recoveryKey.performRecovery).toHaveLength(2);
            });

            it("should have recovery as base key", () => {
                expect(recoveryKey.performRecovery[0]).toBe("recovery");
            });

            it("should always return the same reference", () => {
                const ref1 = recoveryKey.performRecovery;
                const ref2 = recoveryKey.performRecovery;

                expect(ref1).toBe(ref2);
            });
        });

        describe("parseRecoveryFile", () => {
            it("should return constant mutation key", () => {
                expect(recoveryKey.parseRecoveryFile).toEqual([
                    "recovery",
                    "parse-file",
                ]);
            });

            it("should be an array with 2 elements", () => {
                expect(recoveryKey.parseRecoveryFile).toHaveLength(2);
            });

            it("should have recovery as base key", () => {
                expect(recoveryKey.parseRecoveryFile[0]).toBe("recovery");
            });

            it("should always return the same reference", () => {
                const ref1 = recoveryKey.parseRecoveryFile;
                const ref2 = recoveryKey.parseRecoveryFile;

                expect(ref1).toBe(ref2);
            });
        });
    });
});
