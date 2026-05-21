import {
    buildMergeConsentChallenge,
    formatMergeConsentHourSlot,
    WebAuthN,
} from "@frak-labs/app-essentials";
import { authKey, getTauriGetFn } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { type Address, stringToHex } from "viem";

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
 *
 * We sign the *current* UTC hour challenge specifically (the backend accepts
 * ±1h, which absorbs slow flows and clock skew on its side). Signing all
 * three slots client-side would force three biometric prompts for no benefit.
 */
export function useLoserConsent() {
    return useMutation<LoserConsentResult, Error, UseLoserConsentArgs>({
        mutationKey: authKey.merge.consent,
        gcTime: 0,
        mutationFn: async ({ winner, loserAuthenticatorId }) => {
            const challengeString = buildMergeConsentChallenge({
                winner,
                loserAuthenticatorId,
                hourSlot: formatMergeConsentHourSlot(new Date()),
            });
            const challenge = stringToHex(challengeString);

            const tauriGetFn = getTauriGetFn();
            const { metadata, signature, raw } = await WebAuthnP256.sign({
                credentialId: loserAuthenticatorId,
                rpId: WebAuthN.rpId,
                userVerification: "required",
                challenge,
                ...(tauriGetFn && { getFn: tauriGetFn }),
            });

            if (raw.id !== loserAuthenticatorId) {
                // The OS resolved a different credential. Treat as an
                // unrelated assertion — the backend would reject it with the
                // same 401, but failing here is clearer to the user.
                throw new Error("MERGE_CONSENT_WRONG_CREDENTIAL");
            }

            const assertion = {
                id: raw.id,
                response: { metadata, signature },
            };

            return {
                loserConsentSignature: btoa(JSON.stringify(assertion)),
            };
        },
    });
}
