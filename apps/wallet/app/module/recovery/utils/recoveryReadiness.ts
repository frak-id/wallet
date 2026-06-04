import type { CurrentRecovery } from "@frak-labs/wallet-shared";
import { type Address, isAddressEqual } from "viem";

/**
 * Whether a wallet's on-chain recovery can be executed right now with the
 * guardian derived from the user's backup blob. Each non-`ready` variant maps
 * to a dedicated, reassuring screen in the recovery flow.
 */
export type RecoveryReadiness =
    | { kind: "notConfigured" }
    | { kind: "guardianMismatch" }
    | { kind: "tooEarly"; validAfter: number }
    | { kind: "expired"; validUntil: number }
    | { kind: "ready"; validUntil: number };

export function evaluateRecoveryReadiness({
    recovery,
    guardianAddress,
    nowSeconds = Math.floor(Date.now() / 1000),
}: {
    recovery: CurrentRecovery | null;
    guardianAddress: Address;
    nowSeconds?: number;
}): RecoveryReadiness {
    // No recovery executor configured on-chain for this wallet.
    if (!recovery) {
        return { kind: "notConfigured" };
    }
    // The blob's burner is not the guardian registered on the wallet — this
    // backup belongs to a different recovery configuration.
    if (!isAddressEqual(recovery.guardianAddress, guardianAddress)) {
        return { kind: "guardianMismatch" };
    }
    // Security delay still running (`validAfter` is a unix timestamp; 0 means
    // immediately usable).
    if (recovery.validAfter && nowSeconds < recovery.validAfter) {
        return { kind: "tooEarly", validAfter: recovery.validAfter };
    }
    // Expired (`validUntil` 0 means "never expires").
    if (recovery.validUntil && nowSeconds > recovery.validUntil) {
        return { kind: "expired", validUntil: recovery.validUntil };
    }
    return { kind: "ready", validUntil: recovery.validUntil };
}
