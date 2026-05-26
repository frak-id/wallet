import { authKey } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import type { Address } from "viem";
import { signMergeConsentLocally } from "../utils/signMergeConsentLocally";

type UseLoserConsentArgs = {
    winner: Address;
    loserAuthenticatorId: string;
};

/**
 * Result of a successful loser-consent step. The base64 payload mirrors the
 * webauthn assertion shape the backend's `verifyConsentSignature` parses
 * (see `WebAuthNService` in the backend) — keep the structure in lockstep
 * with that parser.
 */
export type LoserConsentResult = {
    /** Base64-encoded JSON ready to send as `loserConsentSignature`. */
    loserConsentSignature: string;
};

/**
 * Triggers a `navigator.credentials.get` against the loser passkey with the
 * deterministic merge-consent challenge, and packages the assertion in the
 * exact shape `POST /user/wallet/merge/settle` expects.
 *
 * This step does double duty:
 *  - It harvests the cryptographic consent signature that the backend
 *    verifies before doing any on-chain reads.
 *  - It proves the loser passkey is physically usable on this device — if
 *    the OS keychain doesn't hold it locally, the prompt fails fast and the
 *    UI can fall back to the "use your other device" placeholder.
 */
export function useLoserConsent() {
    return useMutation<LoserConsentResult, Error, UseLoserConsentArgs>({
        mutationKey: authKey.merge.consent,
        gcTime: 0,
        mutationFn: signMergeConsentLocally,
    });
}
