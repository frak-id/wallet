import type { Address } from "viem";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { recoveryKey } from "./recovery";

describe("recoveryKey", () => {
    describe("currentOption.full", () => {
        test("should generate key with the wallet address", ({
            mockAddress,
        }) => {
            const result = recoveryKey.currentOption.full({
                walletAddress: mockAddress,
            });

            expect(result).toEqual(["recovery", "current-option", mockAddress]);
        });

        test("should be deterministic for the same wallet", ({
            mockAddress,
        }) => {
            const params = { walletAddress: mockAddress };
            expect(recoveryKey.currentOption.full(params)).toEqual(
                recoveryKey.currentOption.full(params)
            );
        });

        test("should generate different keys for different wallets", () => {
            const result1 = recoveryKey.currentOption.full({
                walletAddress:
                    "0x1111111111111111111111111111111111111111" as Address,
            });
            const result2 = recoveryKey.currentOption.full({
                walletAddress:
                    "0x2222222222222222222222222222222222222222" as Address,
            });

            expect(result1).not.toEqual(result2);
        });
    });

    describe("mutation keys", () => {
        test.each([
            ["createRecoveryPasskey", "create-passkey"],
            ["performRecovery", "perform-recovery"],
            ["claimRecovery", "claim-recovery"],
            ["runRecovery", "run-recovery"],
        ] as const)("%s is a stable [base, action] key", (name, action) => {
            const key = recoveryKey[name];
            expect(key).toEqual(["recovery", action]);
            expect(key).toBe(recoveryKey[name]);
        });
    });
});
