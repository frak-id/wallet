import type { Address } from "viem";
import { utcHourSlotWindow } from "./hourSlot";

/**
 * Static prefix included in every merge-consent challenge. Prevents a
 * webauthn signature collected for a different protocol (login, pairing,
 * etc.) from being passed off as merge consent.
 */
export const MERGE_CONSENT_PREFIX = "frak-merge-consent";

/**
 * Build the merge-consent challenge string for a specific UTC hour slot.
 *
 * Format: `frak-merge-consent:{YYYY-MM-DDTHH}:{winner_lower}:{loserAuthenticatorId}`.
 *
 * The winner address is lowercased so client and server agree on a single
 * canonical encoding (ethereum addresses are case-insensitive but
 * `navigator.credentials.get` cares about the exact bytes).
 *
 * The loser authenticator id is included so a signature captured for one
 * victim cannot be replayed against a different victim that happens to be
 * merging into the same winner during the same hour slot.
 */
export function buildMergeConsentChallenge(params: {
    winner: Address;
    loserAuthenticatorId: string;
    hourSlot: string;
}): string {
    return `${MERGE_CONSENT_PREFIX}:${params.hourSlot}:${params.winner.toLowerCase()}:${params.loserAuthenticatorId}`;
}

/**
 * Build the three challenge strings the backend accepts at `/merge/settle`:
 * the current UTC hour, one hour earlier, and one hour later.
 *
 * Both the frontend (when signing) and the backend (when verifying) call
 * this helper so they cannot drift on the format.
 */
export function buildMergeConsentChallengeSlots(params: {
    winner: Address;
    loserAuthenticatorId: string;
    now?: Date;
}): string[] {
    return utcHourSlotWindow(params.now).map((hourSlot) =>
        buildMergeConsentChallenge({
            winner: params.winner,
            loserAuthenticatorId: params.loserAuthenticatorId,
            hourSlot,
        })
    );
}
