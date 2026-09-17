import { type Hex, stringToHex } from "viem";
import { formatUtcHourSlot, utcHourSlotWindow } from "./hourSlot";

/** Shared namespace of every deterministic Frak challenge. */
export const FRAK_CHALLENGE_NAMESPACE = "frak-";

/**
 * Domain separator for the login ceremony, so an assertion collected for
 * another Frak protocol cannot be passed off as a login.
 */
export const LOGIN_CHALLENGE_PREFIX = "frak-login";

/** Hex forms, so `/login` tests a prefix without decoding raw bytes. */
export const FRAK_CHALLENGE_HEX_NAMESPACE = stringToHex(
    FRAK_CHALLENGE_NAMESPACE
);
export const LOGIN_CHALLENGE_HEX_PREFIX = stringToHex(
    `${LOGIN_CHALLENGE_PREFIX}:`
);

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

/** Hex form of {@link buildCurrentLoginChallenge}. */
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

/** Hex form of {@link buildLoginChallengeSlots}. */
export function buildLoginChallengeSlotsHex(params?: { now?: Date }): Hex[] {
    return buildLoginChallengeSlots(params).map((challenge) =>
        stringToHex(challenge)
    );
}

/**
 * Whether a challenge claims the Frak login scheme, and is therefore
 * subject to freshness validation.
 */
export function isLoginChallenge(challenge: string): boolean {
    return challenge.startsWith(`${LOGIN_CHALLENGE_PREFIX}:`);
}

/** Hex-encoded counterpart of {@link isLoginChallenge}. */
export function isLoginChallengeHex(challenge: Hex): boolean {
    return challenge.toLowerCase().startsWith(LOGIN_CHALLENGE_HEX_PREFIX);
}

/**
 * Whether a challenge belongs to a Frak protocol that is not login — a
 * merge consent, say. Clients predating the login scheme sign random
 * bytes, so rejecting these never costs backward compatibility.
 */
export function isForeignFrakChallenge(challenge: string): boolean {
    return (
        challenge.startsWith(FRAK_CHALLENGE_NAMESPACE) &&
        !isLoginChallenge(challenge)
    );
}

/** Hex-encoded counterpart of {@link isForeignFrakChallenge}. */
export function isForeignFrakChallengeHex(challenge: Hex): boolean {
    return (
        challenge.toLowerCase().startsWith(FRAK_CHALLENGE_HEX_NAMESPACE) &&
        !isLoginChallengeHex(challenge)
    );
}
