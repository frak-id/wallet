import { type Hex, stringToHex } from "viem";
import { formatUtcHourSlot, utcHourSlotWindow } from "./hourSlot";

/**
 * Domain separator for the login ceremony, so an assertion collected for
 * another Frak protocol cannot be passed off as a login.
 */
export const LOGIN_CHALLENGE_PREFIX = "frak-login";

/**
 * Build the login challenge for a UTC hour slot: `frak-login:{YYYY-MM-DDTHH}`.
 * Nothing user-specific is bound in — login is credential-discoverable.
 */
export function buildLoginChallenge(params: { hourSlot: string }): string {
    return `${LOGIN_CHALLENGE_PREFIX}:${params.hourSlot}`;
}

/** The challenge a client signs now; the backend accepts this slot ±1h. */
export function buildCurrentLoginChallenge(now?: Date): string {
    return buildLoginChallenge({
        hourSlot: formatUtcHourSlot(now ?? new Date()),
    });
}

/** Hex form of {@link buildCurrentLoginChallenge}, as `WebAuthnP256.sign` wants. */
export function buildCurrentLoginChallengeHex(now?: Date): Hex {
    return stringToHex(buildCurrentLoginChallenge(now));
}

/**
 * The three challenges the backend accepts: the current UTC hour, ±1h.
 * Both sides call this so they cannot drift on the format.
 */
export function buildLoginChallengeSlots(params?: { now?: Date }): string[] {
    return utcHourSlotWindow(params?.now).map((hourSlot) =>
        buildLoginChallenge({ hourSlot })
    );
}

/**
 * Whether a challenge claims the Frak login scheme, and is therefore
 * subject to freshness validation.
 */
export function isLoginChallenge(challenge: string): boolean {
    return challenge.startsWith(`${LOGIN_CHALLENGE_PREFIX}:`);
}
