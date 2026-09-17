import { businessMetrics, log } from "@backend-infrastructure";
import {
    buildLoginChallengeSlots,
    buildLoginChallengeSlotsHex,
    isForeignFrakChallenge,
    isForeignFrakChallengeHex,
    isLoginChallenge,
    isLoginChallengeHex,
} from "@frak-labs/app-essentials";
import type { Hex } from "viem";

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
 * challenge must land in the accepted UTC hour window (current ±1h); one
 * belonging to another Frak protocol is always rejected; anything else is
 * a pre-freshness client, accepted until the flag flips. The challenge is
 * signed into the assertion, so no branch here is a downgrade path.
 */
export function checkLoginChallenge({
    challenge,
    route,
}: LoginChallengeInput): LoginChallengeCheck {
    const isHex = route === "login";

    if (
        isHex
            ? isForeignFrakChallengeHex(challenge)
            : isForeignFrakChallenge(challenge)
    ) {
        businessMetrics.loginChallenge(route, "foreign");
        log.warn(
            { route, challenge: challenge.slice(0, 64) },
            "Rejecting a challenge minted for another Frak protocol"
        );
        return { accepted: false, reason: "Invalid signature" };
    }

    if (
        !(isHex ? isLoginChallengeHex(challenge) : isLoginChallenge(challenge))
    ) {
        businessMetrics.loginChallenge(route, "legacy");
        if (rejectsLegacyChallenge()) {
            return { accepted: false, reason: "Invalid signature" };
        }
        return { accepted: true };
    }

    const accepted: string[] = isHex
        ? buildLoginChallengeSlotsHex()
        : buildLoginChallengeSlots();
    const fresh = accepted.includes(
        isHex ? challenge.toLowerCase() : challenge
    );

    businessMetrics.loginChallenge(route, fresh ? "fresh" : "stale");
    if (!fresh) {
        // Far more often a device whose clock drifted than an attack, so it
        // gets its own reason string; signature validity stays unsaid.
        log.warn(
            { route, challenge: challenge.slice(0, 64) },
            "Rejecting a login challenge outside its hour window"
        );
        return { accepted: false, reason: "Stale challenge" };
    }
    return { accepted: true };
}

/** Boolean view of {@link checkLoginChallenge}. */
export function isFreshLoginChallenge(input: LoginChallengeInput): boolean {
    return checkLoginChallenge(input).accepted;
}
