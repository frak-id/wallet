import type { CurrentRecovery } from "@frak-labs/wallet-shared";
import type { Address } from "viem";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { evaluateRecoveryReadiness } from "./recoveryReadiness";

const GUARDIAN = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;
const NOW = 1_700_000_000;

function recovery(overrides: Partial<CurrentRecovery> = {}): CurrentRecovery {
    return {
        executor: "0x3333333333333333333333333333333333333333" as Address,
        guardianAddress: GUARDIAN,
        validAfter: 0,
        validUntil: 0,
        ...overrides,
    };
}

describe("evaluateRecoveryReadiness", () => {
    test("returns notConfigured when there is no on-chain recovery", () => {
        expect(
            evaluateRecoveryReadiness({
                recovery: null,
                guardianAddress: GUARDIAN,
                nowSeconds: NOW,
            })
        ).toEqual({ kind: "notConfigured" });
    });

    test("returns guardianMismatch when the burner is not the guardian", () => {
        expect(
            evaluateRecoveryReadiness({
                recovery: recovery({ guardianAddress: OTHER }),
                guardianAddress: GUARDIAN,
                nowSeconds: NOW,
            })
        ).toEqual({ kind: "guardianMismatch" });
    });

    test("returns tooEarly before the security delay elapses", () => {
        expect(
            evaluateRecoveryReadiness({
                recovery: recovery({ validAfter: NOW + 100 }),
                guardianAddress: GUARDIAN,
                nowSeconds: NOW,
            })
        ).toEqual({ kind: "tooEarly", validAfter: NOW + 100 });
    });

    test("returns expired after validUntil", () => {
        expect(
            evaluateRecoveryReadiness({
                recovery: recovery({ validUntil: NOW - 100 }),
                guardianAddress: GUARDIAN,
                nowSeconds: NOW,
            })
        ).toEqual({ kind: "expired", validUntil: NOW - 100 });
    });

    test("returns ready inside the window and carries validUntil", () => {
        expect(
            evaluateRecoveryReadiness({
                recovery: recovery({
                    validAfter: NOW - 100,
                    validUntil: NOW + 100,
                }),
                guardianAddress: GUARDIAN,
                nowSeconds: NOW,
            })
        ).toEqual({ kind: "ready", validUntil: NOW + 100 });
    });

    test("treats validUntil 0 as never expiring", () => {
        expect(
            evaluateRecoveryReadiness({
                recovery: recovery({ validAfter: 0, validUntil: 0 }),
                guardianAddress: GUARDIAN,
                nowSeconds: NOW,
            })
        ).toEqual({ kind: "ready", validUntil: 0 });
    });
});
