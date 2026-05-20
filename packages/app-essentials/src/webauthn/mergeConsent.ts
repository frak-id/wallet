import type { Address } from "viem";

/**
 * Static prefix included in every merge-consent challenge. Prevents a
 * webauthn signature collected for a different protocol (login, pairing,
 * etc.) from being passed off as merge consent.
 */
export const MERGE_CONSENT_PREFIX = "frak-merge-consent";

/**
 * Format a `Date` as a UTC hour slot, e.g. `"2026-05-20T14"`. Drives the
 * temporal binding of the merge-consent challenge.
 */
export function formatMergeConsentHourSlot(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}`;
}

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
 * The ±1h window absorbs clock skew between the user's device and the
 * backend, and lets a flow that straddles an hour boundary still succeed.
 *
 * Both the frontend (when signing) and the backend (when verifying) call
 * this helper so they cannot drift on the format.
 */
export function buildMergeConsentChallengeSlots(params: {
    winner: Address;
    loserAuthenticatorId: string;
    now?: Date;
}): string[] {
    const now = params.now ?? new Date();
    const hour = 60 * 60 * 1000;
    return [-1, 0, 1].map((offsetHours) => {
        const slotDate = new Date(now.getTime() + offsetHours * hour);
        return buildMergeConsentChallenge({
            winner: params.winner,
            loserAuthenticatorId: params.loserAuthenticatorId,
            hourSlot: formatMergeConsentHourSlot(slotDate),
        });
    });
}
