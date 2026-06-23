import {
    buildMergeConsentChallenge,
    formatMergeConsentHourSlot,
    WebAuthN,
} from "@frak-labs/app-essentials";
import { getTauriGetFn } from "@frak-labs/wallet-shared";
import { WebAuthnP256 } from "ox";
import { type Address, stringToHex } from "viem";
import { MergeError } from "../errors";

type SignMergeConsentLocallyArgs = {
    winner: Address;
    loserAuthenticatorId: string;
};

/**
 * Sign the deterministic merge-consent challenge with a passkey that is
 * physically resident on this device. Packages the assertion in the exact
 * shape `POST /user/wallet/merge/settle` expects.
 *
 * Used by the local same-device strategy and by the cross-device strategy
 * when desktop is the loser (passkey is on the desktop, not the paired
 * peer) — both call sites need an identical contract so they share this
 * single implementation.
 *
 * We sign the *current* UTC hour challenge specifically (the backend
 * accepts ±1h, which absorbs slow flows and clock skew on its side).
 * Signing all three slots client-side would force three biometric prompts
 * for no benefit.
 */
export async function signMergeConsentLocally({
    winner,
    loserAuthenticatorId,
}: SignMergeConsentLocallyArgs): Promise<{ loserConsentSignature: string }> {
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
        // The OS resolved a different credential. Treat as an unrelated
        // assertion — the backend would reject it with the same 401, but
        // failing here is clearer to the user.
        throw new Error(MergeError.ConsentWrongCredential);
    }

    const assertion = {
        id: raw.id,
        response: { metadata, signature },
    };

    return {
        loserConsentSignature: btoa(JSON.stringify(assertion)),
    };
}
