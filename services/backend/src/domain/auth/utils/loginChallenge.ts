import { businessMetrics, log } from "@backend-infrastructure";
import {
    buildLoginChallengeSlots,
    isLoginChallenge,
} from "@frak-labs/app-essentials";
import { type Hex, hexToString } from "viem";

/**
 * `/login` carries the challenge hex-encoded, `/ecdsaLogin` as the raw
 * string it embeds in the signed message. Encoding follows from the route.
 */
type LoginChallengeInput =
    | { route: "login"; challenge: Hex }
    | { route: "ecdsaLogin"; challenge: string };

type LoginChallengeCheck =
    | { accepted: true }
    | { accepted: false; reason: string };

/**
 * When set, a challenge carrying no `frak-login:` prefix is rejected. Flip
 * once `login_challenge_total{verdict="legacy"}` reaches zero.
 */
function rejectsLegacyChallenge(): boolean {
    return process.env.WALLET_REQUIRE_FRESH_LOGIN_CHALLENGE === "true";
}

/**
 * Freshness gate shared by `/login` and `/ecdsaLogin`. A `frak-login:`
 * challenge must land in the accepted UTC hour window (current ±1h);
 * anything else is a pre-freshness client, accepted until the flag flips.
 * The challenge is signed into the assertion, so neither branch is a
 * downgrade path.
 */
export function checkLoginChallenge({
    challenge,
    route,
}: LoginChallengeInput): LoginChallengeCheck {
    // Decoding also folds hex-digit case, which the slot compare relies on.
    const text = route === "login" ? hexToString(challenge) : challenge;

    if (!isLoginChallenge(text)) {
        businessMetrics.loginChallenge(route, "legacy");
        if (rejectsLegacyChallenge()) {
            return { accepted: false, reason: "Invalid signature" };
        }
        return { accepted: true };
    }

    if (!buildLoginChallengeSlots().includes(text)) {
        businessMetrics.loginChallenge(route, "stale");
        // Far more often a device whose clock drifted than an attack, so it
        // gets its own reason string; signature validity stays unsaid.
        log.warn(
            { route, challenge: text.slice(0, 64) },
            "Rejecting a login challenge outside its hour window"
        );
        return { accepted: false, reason: "Stale challenge" };
    }

    businessMetrics.loginChallenge(route, "fresh");
    return { accepted: true };
}

/** Boolean view of {@link checkLoginChallenge}. */
export function isFreshLoginChallenge(input: LoginChallengeInput): boolean {
    return checkLoginChallenge(input).accepted;
}
