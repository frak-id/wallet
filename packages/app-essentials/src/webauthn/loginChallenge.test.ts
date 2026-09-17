import { hexToString, stringToHex } from "viem";
import { describe, expect, it } from "vitest";
import {
    buildCurrentLoginChallenge,
    buildCurrentLoginChallengeHex,
    buildLoginChallenge,
    buildLoginChallengeSlots,
    buildLoginChallengeSlotsHex,
    isLoginChallenge,
    isLoginChallengeHex,
    LOGIN_CHALLENGE_PREFIX,
} from "./loginChallenge";
import { buildMergeConsentChallenge } from "./mergeConsent";

const MID_HOUR = new Date("2026-05-20T14:37:12.345Z");
const NEW_YEAR = new Date("2026-01-01T00:30:00.000Z");

// Shape of the pre-freshness challenge: `generatePrivateKey()` output.
const LEGACY_CHALLENGE =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

describe("buildLoginChallenge", () => {
    it("formats a challenge as frak-login:{UTC hour slot}", () => {
        expect(buildLoginChallenge({ hourSlot: "2026-05-20T14" })).toBe(
            "frak-login:2026-05-20T14"
        );
    });

    it("pads single-digit month, day and hour", () => {
        expect(
            buildCurrentLoginChallenge(new Date("2026-01-02T03:04:05.000Z"))
        ).toBe("frak-login:2026-01-02T03");
    });

    it("builds the current slot from a fixed date", () => {
        expect(buildCurrentLoginChallenge(MID_HOUR)).toBe(
            "frak-login:2026-05-20T14"
        );
    });

    it("ignores minutes and seconds within the same hour", () => {
        expect(
            buildCurrentLoginChallenge(new Date("2026-05-20T14:00:00.000Z"))
        ).toBe(
            buildCurrentLoginChallenge(new Date("2026-05-20T14:59:59.999Z"))
        );
    });
});

describe("buildLoginChallengeSlots", () => {
    it("returns exactly the previous, current and next hour slots", () => {
        expect(buildLoginChallengeSlots({ now: MID_HOUR })).toEqual([
            "frak-login:2026-05-20T13",
            "frak-login:2026-05-20T14",
            "frak-login:2026-05-20T15",
        ]);
    });

    it("rolls over the UTC day, month and year at midnight", () => {
        expect(buildLoginChallengeSlots({ now: NEW_YEAR })).toEqual([
            "frak-login:2025-12-31T23",
            "frak-login:2026-01-01T00",
            "frak-login:2026-01-01T01",
        ]);
    });

    it("rolls back a day at the start of a month", () => {
        expect(
            buildLoginChallengeSlots({
                now: new Date("2026-03-01T00:10:00.000Z"),
            })
        ).toEqual([
            "frak-login:2026-02-28T23",
            "frak-login:2026-03-01T00",
            "frak-login:2026-03-01T01",
        ]);
    });

    it("includes the challenge a client signs right now", () => {
        expect(buildLoginChallengeSlots({ now: MID_HOUR })).toContain(
            buildCurrentLoginChallenge(MID_HOUR)
        );
    });

    it("defaults to the real clock when no date is given", () => {
        expect(buildLoginChallengeSlots()).toContain(
            buildCurrentLoginChallenge()
        );
    });
});

describe("hex encoding", () => {
    it("round-trips the current challenge through hexToString", () => {
        expect(hexToString(buildCurrentLoginChallengeHex(MID_HOUR))).toBe(
            "frak-login:2026-05-20T14"
        );
    });

    it("emits lowercase hex", () => {
        const hex = buildCurrentLoginChallengeHex(MID_HOUR);
        expect(hex).toBe(hex.toLowerCase());
    });

    it("round-trips every slot and stays lowercase", () => {
        const slots = buildLoginChallengeSlotsHex({ now: MID_HOUR });
        expect(slots.map((slot) => hexToString(slot))).toEqual(
            buildLoginChallengeSlots({ now: MID_HOUR })
        );
        for (const slot of slots) {
            expect(slot).toBe(slot.toLowerCase());
        }
    });

    it("keeps the hex slot window aligned with the string one", () => {
        expect(buildLoginChallengeSlotsHex({ now: NEW_YEAR })).toEqual(
            buildLoginChallengeSlots({ now: NEW_YEAR }).map((challenge) =>
                stringToHex(challenge)
            )
        );
    });
});

describe("isLoginChallenge", () => {
    it("accepts a challenge built by this module", () => {
        expect(isLoginChallenge(buildCurrentLoginChallenge(MID_HOUR))).toBe(
            true
        );
    });

    it("accepts a stale slot: freshness is the caller's job", () => {
        expect(isLoginChallenge("frak-login:1999-01-01T00")).toBe(true);
    });

    it("rejects a legacy random challenge", () => {
        expect(isLoginChallenge(LEGACY_CHALLENGE)).toBe(false);
    });

    it("rejects a merge-consent challenge", () => {
        const consent = buildMergeConsentChallenge({
            winner: "0x1234567890AbcdEF1234567890aBcdef12345678",
            loserAuthenticatorId: "credential-id",
            hourSlot: "2026-05-20T14",
        });
        expect(isLoginChallenge(consent)).toBe(false);
    });

    it("rejects a prefix that is not followed by a separator", () => {
        expect(isLoginChallenge(`${LOGIN_CHALLENGE_PREFIX}-evil:x`)).toBe(
            false
        );
    });
});

describe("isLoginChallengeHex", () => {
    it("accepts a hex challenge built by this module", () => {
        expect(
            isLoginChallengeHex(buildCurrentLoginChallengeHex(MID_HOUR))
        ).toBe(true);
    });

    it("accepts mixed-case hex of a valid challenge", () => {
        const hex = buildCurrentLoginChallengeHex(MID_HOUR);
        expect(isLoginChallengeHex(hex.toUpperCase() as `0x${string}`)).toBe(
            true
        );
    });

    it("rejects a legacy random challenge", () => {
        expect(isLoginChallengeHex(LEGACY_CHALLENGE)).toBe(false);
    });

    it("rejects a hex-encoded merge-consent challenge", () => {
        const consent = stringToHex(
            buildMergeConsentChallenge({
                winner: "0x1234567890AbcdEF1234567890aBcdef12345678",
                loserAuthenticatorId: "credential-id",
                hourSlot: "2026-05-20T14",
            })
        );
        expect(isLoginChallengeHex(consent)).toBe(false);
    });
});
